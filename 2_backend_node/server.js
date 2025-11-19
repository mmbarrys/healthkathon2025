const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Untuk CX dan Mind
const axios = require('axios'); // Untuk SOS (file upload)
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const PYTHON_API_URL = 'http://localhost:5001/api/aura';
const DB_PATH = path.join(__dirname, 'db.json');

// Konfigurasi Multer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware
app.use(express.json());
app.use(cors({ origin: 'http://127.0.0.1:5500' }));


// --- FUNGSI HELPER DATABASE ---
const readDb = () => {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Gagal membaca DB:", err);
        return { complaints: [], responses: [] }; // Fallback
    }
};

const writeDb = (data) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error("Gagal menulis ke DB:", err);
    }
};

/**
 * Endpoint AURA-CX (Frustrasi)
 * (Upgrade: Sekarang mengirim complaintText ke Python)
 */
app.post('/api/aura/trigger/cx', async (req, res) => {
    console.log('[Node.js] Trigger AURA-CX diterima. Memanggil Python/Gemini...');
    
    // Ambil teks keluhan dari body
    const { complaintText } = req.body;

    try {
        const response = await fetch(`${PYTHON_API_URL}/trigger/cx`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ complaintText: complaintText }) // Kirim teksnya
        });

        if (!response.ok) {
            throw new Error(`Python service error: ${response.statusText}`);
        }
        const data = await response.json(); // Harusnya { deescalation, solution }
        console.log('[Node.js] Respon dari Python/Gemini (CX):', data);
        res.json(data); // Kirim JSON ke frontend

    } catch (error) {
        console.error('[Node.js] Error memanggil Python (CX):', error.message);
        res.status(500).json({ error: 'Gagal menghubungi AI Service' });
    }
});

// --- ENDPOINT DATABASE BARU (Permintaan 3 & 4) ---

// Mengambil semua keluhan (untuk Admin)
app.get('/api/complaints', (req, res) => {
    console.log('[Node.js] Mengambil data keluhan untuk admin...');
    const db = readDb();
    res.json(db);
});

// Menyimpan keluhan baru (dari User)
app.post('/api/complaints', (req, res) => {
    const { complaintText } = req.body;
    if (!complaintText) {
        return res.status(400).json({ error: 'Teks keluhan tidak boleh kosong' });
    }

    const db = readDb();
    const newComplaint = {
        id: Date.now(),
        text: complaintText,
        timestamp: new Date().toISOString()
    };
    db.complaints.push(newComplaint);
    writeDb(db);
    
    console.log('[Node.js] Keluhan baru disimpan ke DB:', newComplaint.text);
    res.status(201).json(newComplaint);
});

// Menambah respon baru (dari Admin)
app.post('/api/responses', (req, res) => {
    const { keyword, response } = req.body;
    if (!keyword || !response) {
        return res.status(400).json({ error: 'Keyword dan respon tidak boleh kosong' });
    }
    
    const db = readDb();
    const newResponse = { keyword, response };
    db.responses.push(newResponse);
    writeDb(db);
    
    console.log('[Node.js] Respon admin baru disimpan:', newResponse.keyword);
    res.status(201).json(newResponse);
});

/**
 * Endpoint AURA-Mind (BARU)
 * Mengelola skrining psikologi
 */
app.post('/api/aura/mind', async (req, res) => {
    console.log('[Node.js] Trigger AURA-Mind diterima. Step:', req.body.step);
    
    try {
        const response = await fetch(`${PYTHON_API_URL}/mind`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body) // Teruskan semua data (step, answers)
        });

        if (!response.ok) {
            throw new Error(`Python service error: ${response.statusText}`);
        }
        const data = await response.json();
        console.log('[Node.js] Respon dari Python/Gemini (Mind):', data);
        res.json(data);

    } catch (error) {
        console.error('[Node.js] Error memanggil Python (Mind):', error.message);
        res.status(500).json({ error: 'Gagal menghubungi AI Service (Mind)' });
    }
});


/**
 * Endpoint AURA-SOS (Panik)
 * (Tidak Berubah)
 */
app.post('/api/aura/trigger/sos', upload.single('audio'), async (req, res) => {
    console.log('[Node.js] !! TRIGGER AURA-SOS DITERIMA (VOKAL) !!');
    
    if (!req.file) {
        return res.status(400).json({ error: 'Tidak ada file audio' });
    }
    console.log('[Node.js] Meneruskan audio ke Python SER...');

    try {
        const formData = new FormData();
        formData.append('audio', req.file.buffer, { filename: 'audio.webm' });

        const pyResponse = await axios.post(`${PYTHON_API_URL}/analyze/voice`, formData, {
            headers: formData.getHeaders(),
        });

        const analysis = pyResponse.data;
        console.log('[Node.js] Respon analisis Python SER:', analysis);
        
        if (!analysis.is_panic) {
            return res.json({ 
                eta: null, 
                message: "Vokal terdeteksi tenang. Bantuan dibatalkan."
            });
        }
        
        const mockETA = `${Math.floor(Math.random() * 5) + 5} Menit (Simulasi)`;
        console.log(`[Node.js] !! PANIK TERDETEKSI !! ETA: ${mockETA}`);
        
        res.json({ 
            eta: mockETA,
            message: "PANIK TERDETEKSI! Bantuan dikirim."
        });

    } catch (error) {
        console.error('[Node.js] Error memanggil Python (SOS):', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Gagal menghubungi AI Service (SER)' });
    }
});


app.listen(PORT, () => {
    console.log(`[Node.js] Server Orchestrator (AURA 3.0) berjalan di http://localhost:${PORT}`);
    console.log('Menunggu panggilan dari Frontend (http://127.0.0.1:5500)...');
});