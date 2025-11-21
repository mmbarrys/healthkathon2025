// File: 1_frontend/app.js (V5.0 - Silent SOS & Emergency Tracking)

document.addEventListener('DOMContentLoaded', () => {
    // 1. URL Port Forwarding
    const TUNNEL_URL = 'https://7rtmjns0-3000.asse.devtunnels.ms'; 

    // 2. Logika Deteksi Otomatis
    // Jika browser dibuka di "127.0.0.1" atau "localhost", gunakan Local Backend.
    // Jika tidak (misal dibuka dari HP lewat tunnel), gunakan Tunnel URL.
    const isLocalhost = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    
    const BASE_URL = isLocalhost ? 'http://127.0.0.1:3000' : TUNNEL_URL;

    // 3. Set API URL Final
    const NODE_API_URL = `${BASE_URL}/api/aura`;
    const NODE_DB_URL = `${BASE_URL}/api`;

    console.log(`[AURA] Mode: ${isLocalhost ? 'LOKAL' : 'PUBLIK/TUNNEL'}`);
    console.log(`[AURA] Target API: ${NODE_API_URL}`);

    // --- ELEMENTS ---
    const allPages = document.querySelectorAll('.page');
    const allMenuButtons = document.querySelectorAll('[data-target]');
    
    // CX & Mind Elements (Tetap sama)
    const complaintForm = document.getElementById('complaintForm');
    const submitComplaintButton = document.getElementById('submitComplaintButton');
    const cxStatus = document.getElementById('cxStatus');
    const adaptiveUiNotice = document.getElementById('adaptiveUiNotice'); 
    const cxModal = document.getElementById('cxModal');
    const cxModalContent = document.getElementById('cxModalContent'); 
    const cxModalTitle = document.getElementById('cxModalTitle');
    const cxModalText = document.getElementById('cxModalText');
    const cxModalClose = document.getElementById('cxModalClose');
    const cxIconLoading = document.getElementById('cxIconLoading');
    
    const startScreeningButton = document.getElementById('startScreeningButton');
    const submitScreeningButton = document.getElementById('submitScreeningButton');
    const downloadPdfButton = document.getElementById('downloadPdfButton');
    const mindLoading = document.getElementById('mindLoading');
    const mindStep1 = document.getElementById('mindStep1');
    const mindStep2 = document.getElementById('mindStep2');
    const mindStep3 = document.getElementById('mindStep3');
    const mindQuestionsContainer = document.getElementById('mindQuestionsContainer');
    const mindResultContainer = document.getElementById('mindResultContainer');
    const logoutButton = document.getElementById('logoutButton');

    // SOS Elements (Updated V5)
    const sosOverlay = document.getElementById('sosOverlay');
    const sosStatus = document.getElementById('sosStatus');
    const sosResultArea = document.getElementById('sosResultArea');
    const sosVisualizerContainer = document.getElementById('sosVisualizerContainer');
    const sosProcessList = document.getElementById('sosProcessList');
    const silentSosButton = document.getElementById('silentSosButton'); // Baru
    const sosCancelButton = document.getElementById('sosCancelButton'); // Baru
    const sosTimerBar = document.getElementById('sosTimerBar'); // Baru
    const gpsLocation = document.getElementById('gpsLocation');
    const faskesList = document.getElementById('faskesList');
    const sosCloseButton = document.getElementById('sosCloseButton');
    const canvas = document.getElementById('audioVisualizer');
    
    // STATE
    let mindQuestions = []; 
    let isSimpleMode = false;
    let isSOSRunning = false;
    let mediaRecorder = null;
    let sosStream = null;
    let canvasCtx = canvas ? canvas.getContext('2d') : null;

    // --- HELPERS ---
    function navigateTo(pageId) {
        allPages.forEach(page => page.classList.add('hidden'));
        const target = document.getElementById(pageId);
        if (target) target.classList.remove('hidden');
        
        if (pageId === 'pageKeluhan') {
            isSimpleMode = false;
            if(adaptiveUiNotice) adaptiveUiNotice.classList.add('hidden');
            if(cxStatus) { cxStatus.textContent = "Normal"; cxStatus.className = "text-xs px-2 py-1 bg-slate-100 rounded text-slate-500 font-medium"; }
            if(complaintForm) complaintForm.value = '';
        } else if (pageId === 'pageMind') {
            mindStep1.classList.remove('hidden');
            mindStep2.classList.add('hidden');
            mindStep3.classList.add('hidden');
            if(mindQuestionsContainer) mindQuestionsContainer.innerHTML = '';
            if(mindResultContainer) mindResultContainer.innerHTML = '';
            if(startScreeningButton) startScreeningButton.classList.remove('hidden');
            if(startScreeningButton) startScreeningButton.disabled = false;
            if(mindLoading) mindLoading.classList.add('hidden');
        }
        if(window.lucide) window.lucide.createIcons();
    }

    const highlightStep = (stepNum) => {
        for(let i=1; i<=4; i++) {
            const el = document.getElementById(`step${i}`);
            if(el) {
                const badge = el.querySelector('div');
                if(i < stepNum) { // Completed
                    el.classList.remove('opacity-50'); el.classList.add('opacity-100', 'text-green-300');
                    badge.innerHTML = '✓'; badge.classList.add('bg-green-500', 'border-green-500');
                } else if (i === stepNum) { // Active
                    el.classList.remove('opacity-50'); el.classList.add('opacity-100', 'font-bold', 'scale-105');
                    badge.classList.add('bg-white', 'text-red-600');
                    badge.innerHTML = i;
                } else { // Pending
                    el.classList.add('opacity-50'); el.classList.remove('opacity-100', 'font-bold', 'scale-105');
                    badge.className = "w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold shrink-0";
                    badge.innerHTML = i;
                }
            }
        }
    };

    // --- MAIN MODULE ---
    const AURA = {
        UI: {
            showCXModalLoading: (title, text) => {
                cxModalTitle.textContent = title;
                cxModalText.innerHTML = `<p class='text-center text-slate-500'>${text}</p>`;
                cxIconLoading.style.display = 'block';
                cxModal.classList.remove('hidden');
                setTimeout(() => {
                    cxModalContent.classList.remove('scale-95', 'opacity-0');
                    cxModalContent.classList.add('scale-100', 'opacity-100');
                }, 10);
            },
            showCXIntervention: (deescalation, solution) => {
                cxModalTitle.textContent = "Layanan Pelanggan AURA";
                cxIconLoading.style.display = 'none';
                cxModalText.innerHTML = `
                    <div class="bg-blue-50 p-3 rounded-lg text-blue-800 text-sm font-medium mb-3 border border-blue-100">"${deescalation}"</div>
                    <div class="prose text-sm text-slate-700"><p>${solution}</p></div>
                `;
            },
            hideCXModal: () => {
                cxModalContent.classList.remove('scale-100', 'opacity-100');
                cxModalContent.classList.add('scale-95', 'opacity-0');
                setTimeout(() => cxModal.classList.add('hidden'), 200);
            }
        },

        Sensors: {
            keystroke: {
                lastTime: 0,
                check: (e) => {
                    if(isSimpleMode) return;
                    const now = performance.now();
                    if(e.type === 'keydown') {
                        if(AURA.Sensors.keystroke.lastTime > 0 && (now - AURA.Sensors.keystroke.lastTime) > 800 && complaintForm.value.length > 5) {
                            AURA.Sensors.keystroke.triggerSimpleMode();
                        }
                    }
                    AURA.Sensors.keystroke.lastTime = now;
                },
                triggerSimpleMode: () => {
                    isSimpleMode = true;
                    cxStatus.textContent = "Mode Sederhana";
                    cxStatus.className = "text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded font-bold";
                    if(adaptiveUiNotice) adaptiveUiNotice.classList.remove('hidden');
                    AURA.UI.showCXModalLoading("AURA Mendeteksi Kesulitan", "Kami menyederhanakan tampilan untuk membantu Anda.");
                    setTimeout(AURA.UI.hideCXModal, 2500);
                }
            },

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
                            mindQuestionsContainer.innerHTML += `<div><label class="block text-sm font-bold text-slate-700 mb-2">${i+1}. ${q}</label><input type="text" class="mind-ans w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 focus:bg-white transition" placeholder="Jawaban Anda..."></div>`;
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
                    let allFilled = true;
                    inputs.forEach(i => { if(!i.value) allFilled = false; });
                    if(!allFilled) return alert("Mohon jawab semua pertanyaan.");
                    const answers = Array.from(inputs).map((inp, i) => ({ q: mindQuestions[i], a: inp.value }));
                    
                    mindStep2.classList.add('hidden');
                    mindResultContainer.innerHTML = "<div class='flex flex-col items-center py-12'><div class='w-10 h-10 border-4 border-blue-200 border-t-blue-800 rounded-full animate-spin mb-4'></div><p class='text-slate-500 font-medium'>AI sedang menganalisis jawaban Anda...</p></div>";
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

            voice: {
                start: async () => {
                    if (isSOSRunning) return;
                    if (!canvasCtx || !sosOverlay) return alert("System Error: Canvas not ready.");
                    
                    // UI Reset
                    sosOverlay.classList.remove('hidden');
                    sosResultArea.classList.add('hidden');
                    sosVisualizerContainer.classList.remove('hidden');
                    sosProcessList.classList.add('hidden'); // Sembunyi dulu
                    silentSosButton.classList.remove('hidden'); // Tampilkan tombol silent
                    sosCancelButton.classList.remove('hidden');
                    
                    sosStatus.classList.remove('hidden');
                    sosStatus.textContent = "MENDETEKSI SUARA...";
                    sosTimerBar.style.transform = 'scaleX(1)'; // Reset bar full

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
                            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
                            const barWidth = (canvas.width / bufferLength) * 2.5;
                            let x = 0;
                            for(let i=0; i<bufferLength; i++) {
                                const barHeight = dataArray[i] / 2;
                                canvasCtx.fillStyle = `rgba(255,255,255, ${barHeight/100 + 0.5})`;
                                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                                x += barWidth + 1;
                            }
                        };
                        draw();

                        // Recording & Timer
                        mediaRecorder = new MediaRecorder(stream);
                        audioChunks = [];
                        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
                        
                        // Timer Animation
                        setTimeout(() => { if(isSOSRunning) sosTimerBar.style.transform = 'scaleX(0)'; }, 100);

                        mediaRecorder.onstop = async () => {
                            // Jika dihentikan manual oleh Silent SOS, jangan proses suara
                            if (!isSOSRunning) return; 

                            const blob = new Blob(audioChunks, { type: 'audio/webm' });
                            const formData = new FormData();
                            formData.append('audio', blob);
                            
                            try {
                                const res = await fetch(`${NODE_API_URL}/analyze/voice`, { method: 'POST', body: formData });
                                const data = await res.json();
                                
                                if(data.is_panic) {
                                    // JIKA PANIK: JALANKAN SEQUENCE
                                    AURA.Sensors.voice.triggerEmergencySequence();
                                } else {
                                    // TIDAK PANIK
                                    silentSosButton.classList.add('hidden');
                                    sosVisualizerContainer.classList.add('hidden');
                                    sosStatus.innerHTML = "<span class='text-green-300 text-3xl'>SITUASI AMAN</span>";
                                    sosResultArea.classList.remove('hidden');
                                    sosResultArea.innerHTML = `
                                        <div class="p-6 text-center">
                                            <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <i data-lucide="check" class="w-8 h-8 text-green-600"></i>
                                            </div>
                                            <h3 class="font-bold text-slate-800 mb-2">Tidak Ada Kedaruratan</h3>
                                            <p class="text-sm text-slate-500">Analisis suara menunjukkan kondisi tenang.</p>
                                            <button id="sosCloseSafe" class="mt-6 w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-lg">Tutup</button>
                                        </div>
                                    `;
                                    if(window.lucide) window.lucide.createIcons();
                                    document.getElementById('sosCloseSafe').addEventListener('click', AURA.Sensors.voice.stop);
                                }
                            } catch(e) {
                                alert("Gagal terhubung ke server: " + e);
                                AURA.Sensors.voice.stop();
                            }
                        };

                        mediaRecorder.start();
                        // Auto stop setelah 3 detik
                        setTimeout(() => {
                            if(mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
                        }, 3000); 

                    } catch (err) {
                        alert("Akses mikrofon ditolak.");
                        AURA.Sensors.voice.stop();
                    }
                },
                
                triggerEmergencySequence: () => {
                    // Reset UI for Sequence
                    isSOSRunning = false; // Stop voice logic
                    sosVisualizerContainer.classList.add('hidden');
                    silentSosButton.classList.add('hidden');
                    sosCancelButton.classList.add('hidden');
                    sosProcessList.classList.remove('hidden');
                    
                    // STEP 1: Aktivasi
                    highlightStep(1);
                    sosStatus.textContent = "MENGAKTIFKAN PROTOKOL DARURAT...";

                    setTimeout(() => {
                        // STEP 2: GPS
                        highlightStep(2);
                        sosStatus.textContent = "MELACAK POSISI GPS...";
                        
                        if(navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition((pos) => {
                                const { latitude, longitude } = pos.coords;
                                if(gpsLocation) gpsLocation.textContent = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                            }, () => {
                                if(gpsLocation) gpsLocation.textContent = "-7.2575, 112.7521 (Est)"; // Mock
                            });
                        }

                        setTimeout(() => {
                            // STEP 3: Connecting
                            highlightStep(3);
                            sosStatus.textContent = "MENGHUBUNGI 119...";

                            setTimeout(() => {
                                // STEP 4: Dispatch
                                highlightStep(4);
                                sosStatus.textContent = "DATA TERKIRIM!";

                                setTimeout(() => {
                                    // FINAL: Show Result
                                    sosProcessList.classList.add('hidden');
                                    sosStatus.classList.add('hidden');
                                    sosResultArea.classList.remove('hidden');
                                    
                                    const MOCK_FASKES = [
                                        { name: "RSUD Dr. Soetomo", dist: "1.2 km", time: "5 min" },
                                        { name: "Puskesmas Ketabang", dist: "0.5 km", time: "2 min" },
                                        { name: "Klinik Pratama Sehat", dist: "0.8 km", time: "4 min" }
                                    ];
                                    faskesList.innerHTML = "";
                                    MOCK_FASKES.forEach(f => {
                                        faskesList.innerHTML += `
                                            <li class="flex justify-between items-center bg-slate-50 p-3 rounded border border-slate-100">
                                                <div>
                                                    <span class="block font-bold text-slate-700 text-xs">${f.name}</span>
                                                    <span class="text-xs text-slate-500">Jarak: ${f.dist}</span>
                                                </div>
                                                <span class="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded">${f.time}</span>
                                            </li>
                                        `;
                                    });
                                    
                                    if(window.lucide) window.lucide.createIcons();
                                }, 1500);
                            }, 1500);
                        }, 1500);
                    }, 1000);
                },

                stop: () => {
                    sosOverlay.classList.add('hidden');
                    if(sosStream) sosStream.getTracks().forEach(t => t.stop());
                    if(mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
                    isSOSRunning = false;
                    sosStream = null;
                    navigateTo('pageDashboard'); 
                }
            }
        }
    };

    // --- EVENT LISTENERS ---
    allMenuButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            if(targetId) navigateTo(targetId);
        });
    });

    const sosTrigger = document.querySelector('[data-target="pageSos"]');
    if(sosTrigger) {
        sosTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            AURA.Sensors.voice.start();
        });
    }
    
    // Silent SOS Button Listener (NEW)
    if(silentSosButton) {
        silentSosButton.addEventListener('click', () => {
            console.log("[SOS] Silent Button Clicked. Triggering Emergency...");
            // Hentikan perekaman suara
            if(mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            // Langsung lompat ke sequence darurat
            AURA.Sensors.voice.triggerEmergencySequence();
        });
    }
    
    if(sosCancelButton) {
        sosCancelButton.addEventListener('click', AURA.Sensors.voice.stop);
    }

    if(submitComplaintButton) {
        submitComplaintButton.addEventListener('click', async () => {
            const text = complaintForm.value;
            if(text.length < 5) return alert("Mohon lengkapi.");
            AURA.UI.showCXModalLoading("Menganalisis...", "Mohon tunggu sebentar...");
            try {
                await fetch(`${NODE_DB_URL}/complaints`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ complaintText: text }) });
                const res = await fetch(`${NODE_API_URL}/trigger/cx`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ complaintText: text }) });
                const data = await res.json();
                AURA.UI.showCXIntervention(data.deescalation, data.solution);
            } catch(e) {
                AURA.UI.showCXIntervention("Error", "Gagal terhubung.");
            }
        });
    }

    if(complaintForm) complaintForm.addEventListener('keydown', AURA.Sensors.keystroke.check);
    if(cxModalClose) cxModalClose.addEventListener('click', AURA.UI.hideCXModal);
    if(startScreeningButton) startScreeningButton.addEventListener('click', AURA.Sensors.mind.start);
    if(submitScreeningButton) submitScreeningButton.addEventListener('click', AURA.Sensors.mind.submit);
    if(downloadPdfButton) downloadPdfButton.addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.html(document.getElementById('mindResultContainer'), { callback: function(doc){ doc.save('Laporan.pdf'); }, x: 10, y: 10, width: 180, windowWidth: 650 });
    });
    
    if(sosCloseButton) sosCloseButton.addEventListener('click', AURA.Sensors.voice.stop);
    if(logoutButton) logoutButton.addEventListener('click', () => window.location.href = 'index.html');

    // Init
    if(window.lucide) window.lucide.createIcons();
    navigateTo('pageDashboard');
});