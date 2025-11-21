// File: 2_backend_node/server.js
// AURA Orchestrator V4.5 (Lengkap: CX, DB, & Voice Proxy)

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const axios = require('axios'); // Untuk forward audio ke Python
const multer = require('multer'); // Untuk handle upload audio
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'db.json');

// --- KONFIGURASI URL PYTHON ---
// Gunakan Localhost agar cepat & stabil (Node menembak Python lewat jalur dalam)
const PYTHON_API_URL = 'http://127.0.0.1:5001/api/aura';

console.log(`[Node.js] Target Python AI: ${PYTHON_API_URL}`);

// --- KONFIGURASI MULTER (Untuk Audio SOS) ---
// Simpan file di memori (RAM) sementara sebelum dikirim ke Python
const upload = multer({ storage: multer.memoryStorage() });

// --- MIDDLEWARE ---
app.use(express.json());
app.use(cors({ origin: '*' })); // Izinkan semua origin untuk development

// --- DATABASE HELPER ---
const readDb = () => {
    try {
        if (!fs.existsSync(DB_PATH)) {
            const initialData = { complaints: [], responses: [] };
            fs.writeFileSync(DB_PATH, JSON.stringify(initialData), 'utf8');
            return initialData;
        }
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Gagal membaca DB:", err);
        return { complaints: [], responses: [] };
    }
};

const writeDb = (data) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error("Gagal menulis ke DB:", err);
    }
};

// ===========================
// ROUTE 1: AURA-CX & MIND (Text)
// ===========================

// Proxy ke Python (CX Trigger)
app.post('/api/aura/trigger/cx', async (req, res) => {
    console.log('[Node.js] Meneruskan Trigger CX ke Python...');
    try {
        const response = await fetch(`${PYTHON_API_URL}/trigger/cx`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('[Node.js] Error CX:', error.message);
        res.status(500).json({ deescalation: "Maaf, layanan sibuk.", solution: "Silakan coba lagi." });
    }
});

// Proxy ke Python (Mind Trigger)
app.post('/api/aura/mind', async (req, res) => {
    console.log('[Node.js] Meneruskan Trigger Mind ke Python...');
    try {
        const response = await fetch(`${PYTHON_API_URL}/mind`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('[Node.js] Error Mind:', error.message);
        res.status(500).json({ error: "Gagal menghubungi AI Psikolog." });
    }
});

// ===========================
// ROUTE 2: DATABASE (Keluhan)
// ===========================

app.get('/api/complaints', (req, res) => {
    const db = readDb();
    res.json(db);
});

app.post('/api/complaints', (req, res) => {
    const { complaintText } = req.body;
    if (!complaintText) return res.status(400).json({ error: 'Kosong' });

    const db = readDb();
    const newComplaint = {
        id: Date.now(),
        text: complaintText,
        timestamp: new Date().toISOString()
    };
    db.complaints.push(newComplaint);
    writeDb(db);
    
    console.log('[Node.js] Keluhan disimpan:', complaintText.substring(0, 20) + '...');
    res.status(201).json(newComplaint);
});

app.post('/api/responses', (req, res) => {
    const { keyword, response } = req.body;
    const db = readDb();
    db.responses.push({ keyword, response });
    writeDb(db);
    res.status(201).json({ success: true });
});

// ===========================
// ROUTE 3: AURA-SOS (Voice Proxy) - INI YANG HILANG SEBELUMNYA
// ===========================

app.post('/api/aura/analyze/voice', upload.single('audio'), async (req, res) => {
    console.log('[Node.js] Menerima Audio SOS. Meneruskan ke Python...');
    
    if (!req.file) {
        return res.status(400).json({ error: 'Tidak ada file audio dikirim dari browser.' });
    }

    try {
        // 1. Siapkan form data untuk dikirim ke Python
        const formData = new FormData();
        // req.file.buffer adalah data audio di memori
        formData.append('audio', req.file.buffer, {
            filename: 'upload.webm',
            contentType: req.file.mimetype,
        });

        // 2. Kirim ke Python menggunakan Axios (karena fetch agak ribet dgn multipart)
        const pythonResponse = await axios.post(`${PYTHON_API_URL}/analyze/voice`, formData, {
            headers: {
                ...formData.getHeaders()
            }
        });

        // 3. Kembalikan hasil analisis Python ke Frontend
        console.log('[Node.js] Hasil dari Python:', pythonResponse.data);
        res.json(pythonResponse.data);

    } catch (error) {
        console.error('[Node.js] Gagal meneruskan audio:', error.message);
        // Jika Python mati/error, kita kembalikan respons aman agar UI tidak hang
        res.status(500).json({ 
            error: 'Gagal analisis audio',
            is_panic: false, // Fail-safe: anggap tidak panik
            details: error.message 
        });
    }
});

// --- Health Check Route ---
app.get('/', (req, res) => {
    res.send(`
        <h1>AURA Backend Orchestrator Online</h1>
        <p>Status: Berjalan</p>
        <p>Port: ${PORT}</p>
        <p>Target AI: ${PYTHON_API_URL}</p>
    `);
});

// ===========================
// START SERVER
// ===========================
app.listen(PORT, () => {
    console.log(`[Node.js] Orchestrator berjalan di http://localhost:${PORT}`);
});