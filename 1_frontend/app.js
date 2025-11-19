// File: 1_frontend/app.js
// Versi Final AURA 4.0 (Silent CX, GPS SOS, & Tailored UI)

document.addEventListener('DOMContentLoaded', () => {

    // --- Inisialisasi API URL ---
    const NODE_API_URL = 'http://127.0.0.1:3000/api/aura';
    const NODE_DB_URL = 'http://127.0.0.1:3000/api';

    // --- Ambil Elemen Halaman ---
    const pageContainer = document.getElementById('pageContainer');
    const allPages = document.querySelectorAll('.page');
    const allMenuButtons = document.querySelectorAll('[data-target]');

    // --- Elemen Fitur 1: Keluhan (AURA-CX) ---
    const complaintForm = document.getElementById('complaintForm');
    const submitComplaintButton = document.getElementById('submitComplaintButton');
    const cxStatus = document.getElementById('cxStatus');
    const adaptiveUiNotice = document.getElementById('adaptiveUiNotice'); // Baru
    
    // Modal CS (Struktur Baru)
    const cxModal = document.getElementById('cxModal');
    const cxModalContent = document.getElementById('cxModalContent'); // Baru
    const cxModalTitle = document.getElementById('cxModalTitle');
    const cxModalText = document.getElementById('cxModalText');
    const cxModalClose = document.getElementById('cxModalClose');
    const cxIconLoading = document.getElementById('cxIconLoading');
    
    // --- Elemen Fitur 2: Skrining (AURA-Mind) ---
    const startScreeningButton = document.getElementById('startScreeningButton');
    const submitScreeningButton = document.getElementById('submitScreeningButton');
    const downloadPdfButton = document.getElementById('downloadPdfButton');
    const mindLoading = document.getElementById('mindLoading');
    const mindStep1 = document.getElementById('mindStep1');
    const mindStep2 = document.getElementById('mindStep2');
    const mindStep3 = document.getElementById('mindStep3');
    const mindQuestionsContainer = document.getElementById('mindQuestionsContainer');
    const mindResultContainer = document.getElementById('mindResultContainer');
    let mindQuestions = []; 

    // --- Elemen Fitur 3: SOS (AURA-SOS) ---
    const sosOverlay = document.getElementById('sosOverlay');
    const sosStatus = document.getElementById('sosStatus'); // Ganti sosStatusText
    const sosResultArea = document.getElementById('sosResultArea'); // Baru
    const gpsLocation = document.getElementById('gpsLocation'); // Baru
    const faskesList = document.getElementById('faskesList'); // Baru
    const sosCloseButton = document.getElementById('sosCloseButton');
    const canvas = document.getElementById('audioVisualizer');
    const sosTriggerButton = document.querySelector('[data-target="pageSos"]');
    
    // --- State Global ---
    let isSimpleMode = false; // Ganti isCXTriggered
    let isSOSRunning = false;
    let mediaRecorder;
    let audioChunks = [];
    let audioStream;
    let sosStream = null; // Stream khusus SOS
    let canvasCtx = canvas ? canvas.getContext('2d') : null;
    
    const logError = (context, message, error) => {
        console.error(`[AURA ERROR - ${context}] ${message}`, error || '');
        if (typeof alert !== 'undefined') alert(`ERROR: ${context} failed. Check Console for details.`);
    };
    // --- 1. Navigasi / UI Router ---
    
    function navigateTo(pageId) {
        allPages.forEach(page => page.classList.add('hidden')); // Pakai class hidden (Tailwind)
        
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.remove('hidden');
        }
        
        // Reset State CX saat masuk halaman keluhan
        if (pageId === 'pageKeluhan') {
            isSimpleMode = false;
            if(adaptiveUiNotice) adaptiveUiNotice.classList.add('hidden');
            if(cxStatus) {
                cxStatus.textContent = "Normal";
                cxStatus.className = "text-xs px-2 py-1 bg-slate-100 rounded text-slate-500";
            }
            if(complaintForm) complaintForm.value = '';
        } 
        // Reset State Mind
        else if (pageId === 'pageMind') {
            mindStep1.classList.remove('hidden');
            mindStep2.classList.add('hidden');
            mindStep3.classList.add('hidden');
            mindQuestionsContainer.innerHTML = '';
            mindResultContainer.innerHTML = '';
            startScreeningButton.classList.remove('hidden'); // Pastikan tombol muncul
            startScreeningButton.disabled = false;
            mindLoading.classList.add('hidden');
        }
    }

    allMenuButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const targetId = button.getAttribute('data-target');
            if(targetId === 'pageSos') {
                e.preventDefault(); // Hentikan navigasi default di sini
                AURA.Sensors.voice.start(); // Langsung picu fungsi SOS
            } else if(targetId) {
                navigateTo(targetId);
            }
        });
    });

    // --- 2. Modul AURA (Namespace Global) ---
    
    const AURA = {
        // --- UI Action Engine ---
        UI: {
            showCXModalLoading: (title = "Menghubungkan...", text = "Sedang menganalisis...") => {
                cxModalTitle.textContent = title;
                cxModalText.innerHTML = `<p class='text-center text-slate-500'>${text}</p>`;
                cxIconLoading.style.display = 'block';
                cxModal.classList.remove('hidden');
                
                // Animasi Masuk
                setTimeout(() => {
                    cxModalContent.classList.remove('scale-95', 'opacity-0');
                    cxModalContent.classList.add('scale-100', 'opacity-100');
                }, 10);
            },
            showCXIntervention: (deescalation, solution) => {
                cxModalTitle.textContent = "Layanan Pelanggan AURA";
                cxIconLoading.style.display = 'none';
                cxModalText.innerHTML = `
                    <div class="bg-blue-50 p-3 rounded-lg text-blue-800 text-sm font-medium mb-3">
                        "${deescalation}"
                    </div>
                    <div class="prose text-sm text-slate-700">
                        <p>${solution}</p>
                    </div>
                `;
            },
            hideCXModal: () => {
                cxModalContent.classList.remove('scale-100', 'opacity-100');
                cxModalContent.classList.add('scale-95', 'opacity-0');
                setTimeout(() => cxModal.classList.add('hidden'), 200);
            }
        },

        // --- Sensor Engine ---
        Sensors: {
            // SENSOR 1: AURA-CX (Silent Adaptive UI)
            keystroke: {
                lastTime: 0,
                check: (e) => {
                    if(isSimpleMode) return;
                    
                    const now = performance.now();
                    // Deteksi Flight Time (Jeda panjang > 800ms saat mengetik = bingung)
                    if(e.type === 'keydown') {
                        if(AURA.Sensors.keystroke.lastTime > 0 && (now - AURA.Sensors.keystroke.lastTime) > 800 && complaintForm.value.length > 5) {
                            AURA.Sensors.keystroke.triggerSimpleMode();
                        }
                    }
                    AURA.Sensors.keystroke.lastTime = now;
                },
                triggerSimpleMode: () => {
                    isSimpleMode = true;
                    console.log("[AURA-CX] Mode Sederhana Diaktifkan (Silent)");
                    
                    // Update UI secara halus
                    cxStatus.textContent = "Mode Sederhana";
                    cxStatus.className = "text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded";
                    if(adaptiveUiNotice) adaptiveUiNotice.classList.remove('hidden');
                    
                    // (Opsional) Sembunyikan elemen yang tidak penting
                    // document.querySelectorAll('.complex-ui').forEach(el => el.classList.add('hidden'));
                }
            },

            // SENSOR 2: AURA-Mind
            mind: {
                start: async () => {
                    startScreeningButton.classList.add('hidden');
                    mindLoading.classList.remove('hidden');

                    try {
                        const res = await fetch(`${NODE_API_URL}/mind`, {
                            method: 'POST', headers: {'Content-Type':'application/json'},
                            body: JSON.stringify({ step: 'get_questions' })
                        });
                        const data = await res.json();
                        
                        mindQuestions = data.questions;
                        mindQuestionsContainer.innerHTML = '';
                        mindQuestions.forEach((q, i) => {
                            mindQuestionsContainer.innerHTML += `
                                <div>
                                    <label class="block text-sm font-bold text-slate-700 mb-2">${i+1}. ${q}</label>
                                    <input type="text" class="mind-ans w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Jawaban Anda...">
                                </div>
                            `;
                        });

                        mindStep1.classList.add('hidden');
                        mindStep2.classList.remove('hidden');
                    } catch (e) {
                        alert("Gagal memuat: " + e);
                        startScreeningButton.classList.remove('hidden');
                        mindLoading.classList.add('hidden');
                    }
                },
                submit: async () => {
                    const inputs = document.querySelectorAll('.mind-ans');
                    // Validasi sederhana
                    let allFilled = true;
                    inputs.forEach(i => { if(!i.value) allFilled = false; });
                    if(!allFilled) return alert("Mohon jawab semua pertanyaan.");

                    const answers = Array.from(inputs).map((inp, i) => ({ q: mindQuestions[i], a: inp.value }));
                    
                    mindStep2.classList.add('hidden');
                    mindResultContainer.innerHTML = "<div class='flex flex-col items-center py-8'><div class='w-8 h-8 border-4 border-blue-200 border-t-blue-800 rounded-full animate-spin mb-4'></div><p class='text-slate-500'>AI sedang menganalisis jawaban Anda...</p></div>";
                    mindStep3.classList.remove('hidden');

                    try {
                        const res = await fetch(`${NODE_API_URL}/mind`, {
                            method: 'POST', headers: {'Content-Type':'application/json'},
                            body: JSON.stringify({ step: 'analyze_answers', answers })
                        });
                        const data = await res.json();
                        mindResultContainer.innerHTML = data.report_html;
                    } catch (e) {
                        mindResultContainer.innerHTML = "<p class='text-red-500'>Gagal menganalisis data.</p>";
                    }
                }
            },

            // SENSOR 3: AURA-SOS
            voice: {
                start: async () => {
                    if (isSOSRunning) return;
                    if (!canvasCtx || !sosOverlay) {
                        logError("SOS_INIT", "Canvas atau Overlay tidak ditemukan.", null);
                        return;
                    }
                    sosOverlay.classList.remove('hidden');
                    sosResultArea.classList.add('hidden');
                    sosCloseButton.classList.add('hidden');
                    sosStatus.textContent = "Mendeteksi Kedaruratan...";

                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        sosStream = stream;
                        isSOSRunning = true;
                        
                        // Visualizer
                        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                        const src = audioCtx.createMediaStreamSource(stream);
                        const analyser = audioCtx.createAnalyser();
                        src.connect(analyser);
                        analyser.fftSize = 256;
                        const bufferLength = analyser.frequencyBinCount;
                        const dataArray = new Uint8Array(bufferLength);

                        const draw = () => {
                            if(!sosStream) return;
                            requestAnimationFrame(draw);
                            analyser.getByteFrequencyData(dataArray);
                            canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.2)'; // Trail effect
                            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
                            
                            const barWidth = (canvas.width / bufferLength) * 2.5;
                            let x = 0;
                            for(let i=0; i<bufferLength; i++) {
                                const barHeight = dataArray[i] / 2;
                                canvasCtx.fillStyle = `rgba(255,255,255, ${barHeight/100 + 0.2})`;
                                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                                x += barWidth + 1;
                            }
                        };
                        draw();

                        // Recording
                        mediaRecorder = new MediaRecorder(stream);
                        audioChunks = [];
                        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
                        mediaRecorder.onstop = async () => {
                            const blob = new Blob(audioChunks, { type: 'audio/webm' });
                            const formData = new FormData();
                            formData.append('audio', blob);
                            
                            sosStatus.textContent = "Menganalisis Tingkat Bahaya...";
                            
                            try {
                                const res = await fetch(`${NODE_API_URL}/analyze/voice`, { method: 'POST', body: formData });
                                const data = await res.json();
                                
                                if(data.is_panic) {
                                    AURA.Sensors.voice.triggerEmergency();
                                } else {
                                    sosStatus.textContent = "Situasi Terkendali. Bantuan Dibatalkan.";
                                    sosCloseButton.classList.remove('hidden');
                                    sosCloseButton.textContent = "Tutup";
                                }
                            } catch(e) {
                                sosStatus.textContent = "Gagal terhubung ke server.";
                                sosCloseButton.classList.remove('hidden');
                            }
                            
                            if(sosStream) sosStream.getTracks().forEach(t => t.stop());
                            sosStream = null;
                        };

                        mediaRecorder.start();
                        setTimeout(() => mediaRecorder.stop(), 3000); // Rekam 3 detik

                    } catch (err) {
                        alert("Gagal akses mikrofon: " + err);
                        sosOverlay.classList.add('hidden');
                    }
                },
                triggerEmergency: () => {
                    sosStatus.textContent = "PANIK TERDETEKSI!";
                    sosResultArea.classList.remove('hidden');
                    
                    // Get GPS
                    if(navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition((pos) => {
                            const { latitude, longitude } = pos.coords;
                            gpsLocation.textContent = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                        }, () => {
                            gpsLocation.textContent = "Lokasi Tidak Dikenal";
                        });
                    } else {
                        gpsLocation.textContent = "GPS Tidak Aktif";
                    }

                    // Mock Faskes
                    const MOCK_FASKES = [
                        { name: "RSUD Dr. Soetomo", dist: "1.2 km" },
                        { name: "Puskesmas Ketabang", dist: "0.5 km" },
                        { name: "Klinik Pratama Sehat", dist: "0.8 km" }
                    ];
                    
                    faskesList.innerHTML = "";
                    MOCK_FASKES.forEach(f => {
                        faskesList.innerHTML += `<li class="flex justify-between border-b border-slate-200 pb-1 last:border-0"><span>${f.name}</span><span class="text-blue-600">${f.dist}</span></li>`;
                    });

                    sosCloseButton.classList.remove('hidden');
                    sosCloseButton.textContent = "Ambulans Tiba - Tutup";
                }
            }
        }
    };

    // --- 3. EVENT LISTENERS ---

    // AURA-CX
    if(complaintForm) {
        complaintForm.addEventListener('keydown', AURA.Sensors.keystroke.check);
    }
    
    if(submitComplaintButton) {
        submitComplaintButton.addEventListener('click', async () => {
            const text = complaintForm.value;
            if(text.length < 5) return alert("Mohon lengkapi keluhan Anda.");

            AURA.UI.showCXModalLoading();

            // 1. Simpan DB
            try {
                await fetch(`${NODE_DB_URL}/complaints`, {
                    method: 'POST', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ complaintText: text })
                });
            } catch(e) { console.error(e); }

            // 2. Panggil AI
            try {
                const res = await fetch(`${NODE_API_URL}/trigger/cx`, {
                    method: 'POST', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ complaintText: text })
                });
                const data = await res.json();
                AURA.UI.showCXIntervention(data.deescalation, data.solution);
            } catch(e) {
                AURA.UI.showCXIntervention("Maaf, terjadi kesalahan.", "Silakan hubungi 165.");
            }
        });
    }

    if(cxModalClose) {
        cxModalClose.addEventListener('click', AURA.UI.hideCXModal);
    }

    // AURA-Mind
    if(startScreeningButton) startScreeningButton.addEventListener('click', AURA.Sensors.mind.start);
    if(submitScreeningButton) submitScreeningButton.addEventListener('click', AURA.Sensors.mind.submit);
    
    if(downloadPdfButton) {
        downloadPdfButton.addEventListener('click', () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const element = document.getElementById('mindResultContainer');
            
            doc.html(element, {
                callback: function(doc) { doc.save('Laporan-AURA-Mind.pdf'); },
                x: 15, y: 15, width: 170, windowWidth: 650
            });
        });
    }

    if(sosTriggerButton) {
        sosTriggerButton.addEventListener('click', (e) => {
            // Kita mencegah navigasi default (jika ada) dan langsung memicu start recording.
            e.preventDefault(); 
            AURA.Sensors.voice.start(); 
            // Karena tombol sudah ada di pageMain, kita tidak perlu memanggil navigateTo
            // Kita biarkan navigateTo berjalan untuk memastikan navigasi ke pageSos (yang kosong) terjadi
            navigateTo('pageSos'); 
        });
    }
    // AURA-SOS
    if(sosCloseButton) {
        sosCloseButton.addEventListener('click', () => {
            sosOverlay.classList.add('hidden');
            if(sosStream) sosStream.getTracks().forEach(t => t.stop());
            navigateTo('pageMain');
        });
    }

    // Init
    navigateTo('pageMain');
});