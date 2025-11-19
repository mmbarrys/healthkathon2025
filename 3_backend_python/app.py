import os
import google.generativeai as genai
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import librosa
import numpy as np
from pydub import AudioSegment
import tempfile
import json
from datetime import datetime

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY tidak ditemukan.")
    
genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-2.5-flash')

# --- PROMPT ENGINEERING (ADVANCED V4.0) ---
PROMPTS = {
    # 1. AURA-CX: Customer Service Persona
    "frustration_and_solution": """
    Bertindaklah sebagai 'AURA', Customer Service AI dari BPJS Kesehatan yang sangat profesional, hangat, dan solutif.
    
    Pengguna menyampaikan keluhan: "{COMPLAINT_TEXT}"
    
    Tugas Anda: Berikan respon JSON.
    1. "deescalation": Ucapan empati singkat (maks 15 kata) layaknya CS manusia.
    2. "solution": Jawaban teknis/solusi yang jelas, sopan, dan membantu (maks 60 kata).

    Contoh JSON:
    {{
      "deescalation": "Kami mohon maaf atas ketidaknyamanan yang Ibu/Bapak alami.",
      "solution": "Untuk kendala tersebut, silakan coba hapus cache aplikasi Mobile JKN Anda atau pastikan koneksi internet stabil. Jika berlanjut, hubungi 165."
    }}
    """,
    
    # 2. AURA-Mind: Pertanyaan Fleksibel
    "mind_get_questions": """
    Anda adalah psikolog klinis AI dengan pengalaman dibidang psikologis dan psikiater selama 25 tahun lebih. Buatlah minimal 7 pertanyaan, boleh lebih pertanyaan skrining psikologis singkat untuk mendeteksi tingkat stres dan kecemasan pengguna atau psikologis terkini pengguna.
    Output: HANYA array JSON berisi string pertanyaan, serta contoh menjawabnya.
    Contoh: ["Apakah Anda merasa gelisah?", "Bagaimana tidur Anda?"( contoh jawaban: betul, biasa saja, atau jelaskan sesuai kondisi anda saat ini)]
    """,

    # 3. AURA-Mind: Laporan Rapi (Tailwind Friendly)
    "mind_analyze_answers": """
    Anda adalah psikolog AI. Analisis jawaban pengguna berikut:
    {ANSWERS_TEXT}

    Buat laporan HTML yang rapi dan profesional. Gunakan tag <h3>, <p>, <ul>, <li>.
    JANGAN gunakan tag <html>, <head>, atau <body>.
    
    Struktur Laporan:
    1. <h3>Ringkasan Kondisi</h3>: Penjelasan empatik (1 paragraf).
    2. <h3>Analisis Mendalam</h3>: Poin-poin gejala yang terdeteksi.
    3. <h3>Saran & Langkah Selanjutnya</h3>: Tips praktis (meditasi, tidur, dll).
    4. <div class="disclaimer"> (Peringatan bahwa ini bukan diagnosis medis).
    
    Tambahkan: Tanggal Pemeriksaan {CURRENT_DATE}.
    """
}

@app.route('/api/aura/trigger/cx', methods=['POST'])
def trigger_cx():
    try:
        data = request.json
        complaint_text = data.get('complaintText', '')
        if not complaint_text: complaint_text = "Saya bingung menggunakan aplikasi ini."
        
        prompt = PROMPTS["frustration_and_solution"].format(COMPLAINT_TEXT=complaint_text)
        response = model.generate_content(prompt)
        text = response.text.strip().replace("```json", "").replace("```", "").strip()
        return jsonify(json.loads(text))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/aura/mind', methods=['POST'])
def aura_mind():
    try:
        data = request.json
        step = data.get('step')

        if step == 'get_questions':
            prompt = PROMPTS["mind_get_questions"]
            response = model.generate_content(prompt)
            text = response.text.strip().replace("```json", "").replace("```", "").strip()
            return jsonify({"questions": json.loads(text)})

        elif step == 'analyze_answers':
            answers = data.get('answers', [])
            answers_text = "\n".join([f"Tanya: {x['q']}\nJawab: {x['a']}" for x in answers])
            current_date = datetime.now().strftime("%d %B %Y")
            
            prompt = PROMPTS["mind_analyze_answers"].format(ANSWERS_TEXT=answers_text, CURRENT_DATE=current_date)
            response = model.generate_content(prompt)
            return jsonify({"report_html": response.text.strip()})

    except Exception as e:
        print(f"Error Mind: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/aura/analyze/voice', methods=['POST'])
def analyze_voice():
    if 'audio' not in request.files: return jsonify({"error": "No audio"}), 400
    
    file = request.files['audio']
    with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_webm:
        file.save(temp_webm.name)
        temp_path = temp_webm.name
    
    try:
        wav_path = temp_path.replace('.webm', '.wav')
        AudioSegment.from_file(temp_path).export(wav_path, format="wav")
        y, sr = librosa.load(wav_path)
        
        # Analisis Emosi Sederhana (ZCR + Energy)
        zcr = np.mean(librosa.feature.zero_crossing_rate(y))
        rms = np.mean(librosa.feature.rms(y=y))
        
        # Threshold Panik (Disesuaikan agar lebih sensitif untuk demo)
        is_panic = (zcr > 0.05) or (rms > 0.05)
        
        return jsonify({"is_panic": is_panic, "metrics": {"zcr": zcr, "rms": rms}})
    except Exception as e:
        print(f"Error Audio: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(temp_path): os.remove(temp_path)
        if 'wav_path' in locals() and os.path.exists(wav_path): os.remove(wav_path)

if __name__ == '__main__':
    app.run(port=5001)