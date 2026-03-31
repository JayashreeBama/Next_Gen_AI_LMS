import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import JSZip from 'jszip';
import { GoogleGenAI } from '@google/genai';
import admin from 'firebase-admin';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
admin.initializeApp({
  projectId: firebaseConfig.projectId,
});

const db = new Database('database.db');
const gemini = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// Initialize Database (SQLite for materials, questions, progress)
db.exec(`
  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id TEXT,
    department TEXT,
    subject TEXT,
    topic TEXT,
    description TEXT,
    file_path TEXT,
    resource_type TEXT,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id TEXT,
    subject TEXT,
    topic TEXT,
    question_text TEXT,
    option_a TEXT,
    option_b TEXT,
    option_c TEXT,
    option_d TEXT,
    correct_answer TEXT
  );

  CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT,
    question_id INTEGER,
    selected_answer TEXT,
    score INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(question_id) REFERENCES questions(id)
  );

  CREATE TABLE IF NOT EXISTS material_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT,
    material_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(material_id) REFERENCES materials(id)
  );
`);

// Lightweight schema migration for existing local databases.
const materialColumns = db.prepare("PRAGMA table_info(materials)").all() as Array<{ name: string }>;
if (!materialColumns.some((c) => c.name === 'department')) {
  db.exec('ALTER TABLE materials ADD COLUMN department TEXT');
}

// Ensure upload directories exist
const uploadDirs = ['public/uploads', 'public/uploads/videos', 'public/uploads/images', 'public/uploads/docs', 'public/uploads/zips'];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest = 'public/uploads/docs';
    if (file.mimetype.startsWith('image/')) dest = 'public/uploads/images';
    else if (file.mimetype.startsWith('video/')) dest = 'public/uploads/videos';
    else if (file.originalname.endsWith('.zip')) dest = 'public/uploads/zips';
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

async function convertExistingMaterialsToZip() {
  const rows = db.prepare(`
    SELECT id, file_path, resource_type
    FROM materials
    WHERE file_path LIKE '/uploads/%'
      AND (resource_type IS NULL OR (LOWER(resource_type) != 'zip' AND LOWER(resource_type) != 'ai_generated'))
  `).all() as Array<{ id: number; file_path: string; resource_type: string | null }>;

  for (const row of rows) {
    try {
      const filePath = String(row.file_path || '');
      const absolutePath = path.resolve('public', filePath.replace(/^\//, ''));
      if (!fs.existsSync(absolutePath)) continue;

      const fileBuffer = await fs.promises.readFile(absolutePath);
      const originalName = path.basename(absolutePath);

      const zip = new JSZip();
      zip.file(originalName, fileBuffer);

      const zipFileName = `${Date.now()}-material-${row.id}.zip`;
      const zipAbsolutePath = path.resolve('public', 'uploads', 'zips', zipFileName);
      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });

      await fs.promises.writeFile(zipAbsolutePath, zipBuffer);
      await fs.promises.unlink(absolutePath).catch(() => undefined);

      db.prepare('UPDATE materials SET file_path = ?, resource_type = ? WHERE id = ?').run(
        `/uploads/zips/${zipFileName}`,
        'zip',
        row.id
      );
    } catch (error) {
      console.warn(`Skipping ZIP conversion for material ${row.id}:`, error);
    }
  }
}

async function restoreAiGeneratedMaterialsFromZip() {
  const rows = db.prepare(`
    SELECT id, file_path, resource_type
    FROM materials
    WHERE LOWER(resource_type) = 'zip'
      AND file_path LIKE '/uploads/zips/%'
  `).all() as Array<{ id: number; file_path: string; resource_type: string | null }>;

  for (const row of rows) {
    try {
      const filePath = String(row.file_path || '');
      const absolutePath = path.resolve('public', filePath.replace(/^\//, ''));
      if (!fs.existsSync(absolutePath)) continue;

      const zipBuffer = await fs.promises.readFile(absolutePath);
      const zip = await JSZip.loadAsync(zipBuffer);
      const jsonEntryName = Object.keys(zip.files).find((name) => name.toLowerCase().endsWith('.json'));
      if (!jsonEntryName) continue;

      const jsonText = await zip.files[jsonEntryName].async('string');
      let parsed: any;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        continue;
      }

      const looksLikeAiPlan =
        typeof parsed?.objective === 'string' ||
        typeof parsed?.studyGuide === 'string' ||
        Array.isArray(parsed?.resources?.youtube) ||
        Array.isArray(parsed?.resources?.websites);
      if (!looksLikeAiPlan) continue;

      const restoredName = `${Date.now()}-ai-material-${row.id}.json`;
      const restoredAbsolutePath = path.resolve('public', 'uploads', 'docs', restoredName);
      await fs.promises.writeFile(restoredAbsolutePath, jsonText, 'utf-8');

      db.prepare('UPDATE materials SET file_path = ?, resource_type = ? WHERE id = ?').run(
        `/uploads/docs/${restoredName}`,
        'AI_GENERATED',
        row.id
      );
    } catch (error) {
      console.warn(`Skipping AI restore for material ${row.id}:`, error);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static('public/uploads'));

  await restoreAiGeneratedMaterialsFromZip();
  await convertExistingMaterialsToZip();

  // Auth Middleware using Firebase Admin
  // Uses Firestore REST API instead of admin.firestore() to avoid needing
  // Application Default Credentials / a service account key locally.
  const authenticateToken = async (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    try {
      // verifyIdToken only uses public keys — no ADC needed
      const decodedToken = await admin.auth().verifyIdToken(token);

      // Fetch role via Firestore REST API using the user's own Bearer token
      let role: string | undefined;
      let name: string | undefined;
      let department: string | undefined;
      let course: string | undefined;
      try {
        const fsRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/users/${decodedToken.uid}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (fsRes.ok) {
          const data = await fsRes.json();
          role = data.fields?.role?.stringValue;
          name = data.fields?.name?.stringValue;
          department = data.fields?.department?.stringValue;
          course = data.fields?.course?.stringValue;
        }
      } catch (_) { /* fall through to email fallback */ }

      // Fallback: recognise admin@gmail.com before its Firestore doc is created
      if (!role && decodedToken.email === 'admin@gmail.com') {
        role = 'admin';
        name = 'Admin';
      }

      if (!role) {
        return res.status(403).json({ message: 'User profile not found' });
      }

      req.user = {
        id: decodedToken.uid,
        email: decodedToken.email,
        role,
        name: name || decodedToken.email,
        department,
        course,
        token, // forwarded to admin routes that need Firestore REST API access
      };
      next();
    } catch (error) {
      console.error('Auth Error:', error);
      res.sendStatus(403);
    }
  };

  // --- Auth Routes (Most logic moved to frontend with Firebase Auth) ---
  // The server just needs to verify tokens for other routes.
  
  // --- Admin Routes ---
  app.get('/api/admin/staff', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    try {
      const response = await fetch(
        `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents:runQuery`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${req.user.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: 'users' }],
              where: { fieldFilter: { field: { fieldPath: 'role' }, op: 'EQUAL', value: { stringValue: 'staff' } } }
            }
          })
        }
      );
      const results = await response.json();
      const staff = results
        .filter((r: any) => r.document)
        .map((r: any) => ({
          id: r.document.name.split('/').pop(),
          name: r.document.fields.name?.stringValue,
          email: r.document.fields.email?.stringValue,
          department: r.document.fields.department?.stringValue,
          phone: r.document.fields.phone?.stringValue,
          role: r.document.fields.role?.stringValue,
        }));
      res.json(staff);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch staff' });
    }
  });

  app.delete('/api/admin/staff/:id', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    try {
      // Delete Firestore document via REST API
      await fetch(
        `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/users/${req.params.id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${req.user.token}` } }
      );
      // Delete from Firebase Auth (requires service account — fails gracefully if unavailable)
      try { await admin.auth().deleteUser(req.params.id); } catch (e: any) {
        console.warn('Firebase Auth user deletion skipped (no service account configured):', e.message);
      }
      res.json({ message: 'Staff deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete staff' });
    }
  });

  app.get('/api/admin/students', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    try {
      const response = await fetch(
        `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents:runQuery`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${req.user.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: 'users' }],
              where: { fieldFilter: { field: { fieldPath: 'role' }, op: 'EQUAL', value: { stringValue: 'student' } } }
            }
          })
        }
      );
      const results = await response.json();
      const students = results
        .filter((r: any) => r.document)
        .map((r: any) => ({
          id: r.document.name.split('/').pop(),
          name: r.document.fields.name?.stringValue,
          email: r.document.fields.email?.stringValue,
          course: r.document.fields.course?.stringValue,
          year: r.document.fields.year?.stringValue,
          role: r.document.fields.role?.stringValue,
        }));
      res.json(students);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch students' });
    }
  });

  app.delete('/api/admin/students/:id', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    try {
      // Delete Firestore document via REST API
      await fetch(
        `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/users/${req.params.id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${req.user.token}` } }
      );
      // Delete from Firebase Auth (requires service account — fails gracefully if unavailable)
      try { await admin.auth().deleteUser(req.params.id); } catch (e: any) {
        console.warn('Firebase Auth user deletion skipped (no service account configured):', e.message);
      }
      res.json({ message: 'Student deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete student' });
    }
  });

  // --- Staff Routes (SQLite storage) ---
  app.post('/api/staff/materials', authenticateToken, upload.single('file'), async (req: any, res) => {
    if (req.user.role !== 'staff') return res.sendStatus(403);
    const { subject, topic, description, resource_type, link } = req.body;
    const staffDepartment = req.user.department || null;

    try {
      let filePath = req.file ? `/uploads/${req.file.destination.split('/').pop()}/${req.file.filename}` : link;
      let storedResourceType = resource_type;

      if (req.file) {
        const requestedType = String(resource_type || '').toUpperCase();
        if (requestedType === 'AI_GENERATED') {
          filePath = `/uploads/${req.file.destination.split('/').pop()}/${req.file.filename}`;
          storedResourceType = 'AI_GENERATED';
        } else {
        const originalName = String(req.file.originalname || 'material');
        const isZipUpload = originalName.toLowerCase().endsWith('.zip') || String(req.file.mimetype || '').includes('zip');

        if (isZipUpload) {
          storedResourceType = 'zip';
        } else {
          const sourcePath = path.resolve(req.file.path);
          const fileBuffer = await fs.promises.readFile(sourcePath);
          const zip = new JSZip();
          zip.file(originalName, fileBuffer);

          const zipFileName = `${Date.now()}-${path.parse(originalName).name}.zip`;
          const zipAbsolutePath = path.resolve('public', 'uploads', 'zips', zipFileName);
          const zipBuffer = await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 9 },
          });

          await fs.promises.writeFile(zipAbsolutePath, zipBuffer);
          // Remove original uploaded file after successful compression.
          await fs.promises.unlink(sourcePath).catch(() => undefined);

          filePath = `/uploads/zips/${zipFileName}`;
          storedResourceType = 'zip';
        }
        }
      }

      db.prepare('INSERT INTO materials (staff_id, department, subject, topic, description, file_path, resource_type) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        req.user.id,
        staffDepartment,
        subject,
        topic,
        description,
        filePath,
        storedResourceType
      );
      res.json({ message: 'Material uploaded' });
    } catch (err) {
      console.error('Database error saving material:', err);
      res.status(500).json({ error: 'Failed to save material to database' });
    }
  });

  app.get('/api/staff/materials', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'staff') return res.sendStatus(403);
    const staffDept = String(req.user.department || '').trim();
    try {
      // Return materials uploaded by this staff OR materials matching the staff's department OR global materials
      const materials = db.prepare(
        `SELECT * FROM materials WHERE staff_id = ? OR (LOWER(department) = LOWER(?) OR department IS NULL OR department = '') ORDER BY upload_date DESC`
      ).all(req.user.id, staffDept);
      // Fallback: return all materials if none matched (so staff still sees recent uploads)
      if (!materials || materials.length === 0) {
        const all = db.prepare('SELECT * FROM materials ORDER BY upload_date DESC').all();
        return res.json(all);
      }
      return res.json(materials);
    } catch (err) {
      console.error('Failed to fetch staff materials:', err);
      return res.status(500).json({ error: 'Failed to fetch materials' });
    }
  });

  app.get('/api/staff/progress', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'staff') return res.sendStatus(403);
    try {
      let rows = db.prepare(`
        SELECT p.student_id, q.topic, p.score, p.timestamp as status
        FROM progress p
        JOIN questions q ON p.question_id = q.id
        WHERE q.staff_id = ?
        ORDER BY p.timestamp DESC
      `).all(req.user.id) as Array<any>;

      // Fallback: if staff has no matched progress (maybe questions missing staff_id), return recent progress across the board
      if (!rows || rows.length === 0) {
        rows = db.prepare(`
          SELECT p.student_id, q.topic, p.score, p.timestamp as status
          FROM progress p
          JOIN questions q ON p.question_id = q.id
          ORDER BY p.timestamp DESC
          LIMIT 20
        `).all() as Array<any>;
      }

      // Enrich with student name by fetching Firestore user documents (best-effort)
      const uniqueStudentIds = Array.from(new Set(rows.map(r => r.student_id).filter(Boolean)));
      const studentNameMap: Record<string, string> = {};

      await Promise.all(uniqueStudentIds.map(async (sid) => {
        try {
          const fsRes = await fetch(
            `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/users/${sid}`,
            { headers: { Authorization: `Bearer ${req.user.token}` } }
          );
          if (fsRes.ok) {
            const data = await fsRes.json();
            studentNameMap[sid] = data.fields?.name?.stringValue || sid;
          } else {
            studentNameMap[sid] = sid;
          }
        } catch (err) {
          studentNameMap[sid] = sid;
        }
      }));

      const enriched = rows.map(r => ({
        ...r,
        student_name: studentNameMap[r.student_id] || r.student_id
      }));

      res.json(enriched);
    } catch (err) {
      console.error('Failed to fetch staff progress:', err);
      res.status(500).json({ error: 'Failed to fetch progress' });
    }
  });

  app.get('/api/staff/questions', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'staff') return res.sendStatus(403);
    try {
      const questions = db.prepare(`
        SELECT id, subject, topic, question_text, option_a, option_b, option_c, option_d, correct_answer
        FROM questions
        WHERE staff_id = ?
        ORDER BY id DESC
      `).all(req.user.id);
      res.json(questions);
    } catch (err) {
      console.error('Failed to fetch staff questions:', err);
      res.status(500).json({ error: 'Failed to fetch staff questions' });
    }
  });

  app.post('/api/staff/questions', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'staff') return res.sendStatus(403);
    const { subject, topic, questions } = req.body;

    if (!subject || !topic || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Invalid payload. subject, topic and non-empty questions are required.' });
    }

    const validQuestions = questions
      .map((q: any) => ({
        question_text: String(q?.question_text ?? '').trim(),
        option_a: String(q?.option_a ?? '').trim(),
        option_b: String(q?.option_b ?? '').trim(),
        option_c: String(q?.option_c ?? '').trim(),
        option_d: String(q?.option_d ?? '').trim(),
        correct_answer: String(q?.correct_answer ?? 'A').trim().toUpperCase(),
      }))
      .filter((q: any) => q.question_text && q.option_a && q.option_b && q.option_c && q.option_d)
      .map((q: any) => ({
        ...q,
        correct_answer: ['A', 'B', 'C', 'D'].includes(q.correct_answer) ? q.correct_answer : 'A',
      }));

    if (validQuestions.length === 0) {
      return res.status(400).json({ error: 'No valid questions to save.' });
    }

    const insert = db.prepare('INSERT INTO questions (staff_id, subject, topic, question_text, option_a, option_b, option_c, option_d, correct_answer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const transaction = db.transaction((rows: any[]) => {
      rows.forEach((q: any) => {
        insert.run(req.user.id, subject, topic, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer);
      });
    });

    try {
      transaction(validQuestions);
      res.json({ message: 'Questions saved', savedCount: validQuestions.length });
    } catch (err) {
      console.error('Failed to save questions:', err);
      res.status(500).json({ error: 'Failed to save questions' });
    }
  });

  app.get('/api/student/materials', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'student') return res.sendStatus(403);
    const studentDepartment = String(req.user.department || '').trim();

    let materials: any[] = [];
    if (studentDepartment) {
      materials = db.prepare(
        'SELECT * FROM materials WHERE LOWER(department) = LOWER(?) OR department IS NULL OR department = "" ORDER BY upload_date DESC'
      ).all(studentDepartment) as any[];

      // Fallback for profile/department naming mismatch so students can still see uploaded content.
      if (materials.length === 0) {
        materials = db.prepare('SELECT * FROM materials ORDER BY upload_date DESC').all() as any[];
      }
    } else {
      materials = db.prepare('SELECT * FROM materials ORDER BY upload_date DESC').all() as any[];
    }

    res.json(materials);
  });

  app.post('/api/student/materials/:id/access', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'student') return res.sendStatus(403);
    db.prepare('INSERT INTO material_access (student_id, material_id) VALUES (?, ?)').run(req.user.id, req.params.id);
    res.json({ message: 'Access logged' });
  });

  app.post('/api/student/chatbot', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'student') return res.sendStatus(403);
    if (!gemini) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on server.' });
    }

    const message = String(req.body?.message || '').trim();
    const historyInput = Array.isArray(req.body?.history) ? req.body.history : [];
    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const history = historyInput
      .slice(-8)
      .map((m: any) => ({
        role: m?.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m?.content || '').slice(0, 1000) }],
      }))
      .filter((m: any) => String(m.parts?.[0]?.text || '').trim().length > 0);

    try {
      const prompt = `You are a helpful educational chatbot for students. Keep answers concise, clear, and practical. If asked outside study context, still answer politely in a safe manner.`;
      const result = await gemini.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [
          { role: 'user', parts: [{ text: prompt }] },
          ...history,
          { role: 'user', parts: [{ text: message }] }
        ]
      });

      const reply = String(result.text || '').trim();
      if (!reply) {
        return res.status(502).json({ error: 'No response from chatbot.' });
      }
      return res.json({ reply });
    } catch (error) {
      console.error('Student chatbot error:', error);
      return res.status(500).json({ error: 'Failed to get chatbot response.' });
    }
  });

  app.get('/api/student/materials/:id/download', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'student') return res.sendStatus(403);

    const material = db.prepare('SELECT id, subject, topic, description, resource_type, file_path FROM materials WHERE id = ?').get(req.params.id) as any;
    if (!material) return res.status(404).json({ error: 'Material not found' });

    const filePath = String(material.file_path || '');
    if (!filePath) return res.status(400).json({ error: 'No file available for download' });

    const safeBaseName = String(material.topic || `material-${material.id}`)
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || `material-${material.id}`;
    const zipName = `${safeBaseName}.zip`;

    // External resources are packaged into a zip text manifest.
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      const zip = new JSZip();
      const manifest = [
        `Subject: ${material.subject || ''}`,
        `Topic: ${material.topic || ''}`,
        `Type: ${material.resource_type || ''}`,
        `Description: ${material.description || ''}`,
        `URL: ${filePath}`,
      ].join('\n');
      zip.file('resource-link.txt', manifest);
      zip.file('link.url', `[InternetShortcut]\nURL=${filePath}\n`);

      return zip
        .generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } })
        .then((buffer) => {
          res.setHeader('Content-Type', 'application/zip');
          res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
          res.send(buffer);
        })
        .catch((error) => {
          console.error('Failed to create zip for external resource:', error);
          res.status(500).json({ error: 'Failed to prepare download' });
        });
    }

    if (!filePath.startsWith('/uploads/')) {
      return res.status(400).json({ error: 'Unsupported material path' });
    }

    const uploadsRoot = path.resolve(process.cwd(), 'public', 'uploads');
    const resolvedPath = path.resolve(process.cwd(), 'public', filePath.replace(/^\//, ''));

    // Prevent path traversal outside uploads directory.
    if (!resolvedPath.startsWith(uploadsRoot)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // If already zipped, send directly.
    if (String(material.resource_type || '').toLowerCase() === 'zip' || resolvedPath.toLowerCase().endsWith('.zip')) {
      return res.download(resolvedPath, path.basename(resolvedPath));
    }

    // For non-zip local files, return a generated zip package.
    return fs.promises
      .readFile(resolvedPath)
      .then((fileBuffer) => {
        const zip = new JSZip();
        zip.file(path.basename(resolvedPath), fileBuffer);
        return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
      })
      .then((buffer) => {
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
        res.send(buffer);
      })
      .catch((error) => {
        console.error('Failed to create zip download:', error);
        res.status(500).json({ error: 'Failed to prepare download' });
      });
  });

  app.get('/api/student/questions', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'student') return res.sendStatus(403);
    const questions = db.prepare('SELECT id, subject, topic, question_text, option_a, option_b, option_c, option_d FROM questions').all();
    res.json(questions);
  });

  app.post('/api/student/submit-answer', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'student') return res.sendStatus(403);
    const { question_id, selected_answer } = req.body;
    const question = db.prepare('SELECT correct_answer FROM questions WHERE id = ?').get(question_id);
    const score = selected_answer === question.correct_answer ? 1 : 0;
    db.prepare('INSERT INTO progress (student_id, question_id, selected_answer, score) VALUES (?, ?, ?, ?)').run(req.user.id, question_id, selected_answer, score);
    res.json({ score, correct_answer: question.correct_answer });
  });

  app.get('/api/student/progress', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'student') return res.sendStatus(403);
    const progress = db.prepare(`
      SELECT q.subject, q.topic, p.score, p.timestamp
      FROM progress p
      JOIN questions q ON p.question_id = q.id
      WHERE p.student_id = ?
    `).all(req.user.id);
    res.json(progress);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => res.sendFile(path.resolve(__dirname, 'dist', 'index.html')));
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
