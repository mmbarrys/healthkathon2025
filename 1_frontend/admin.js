// File: 1_frontend/admin.js
document.addEventListener('DOMContentLoaded', () => {
    
    const API_URL = 'http://localhost:3000/api';
    const complaintsTableBody = document.getElementById('complaints-table-body');
    const responseForm = document.getElementById('response-form');

    // 1. Muat semua keluhan saat halaman dibuka
    async function loadComplaints() {
        try {
            const res = await fetch(`${API_URL}/complaints`);
            const data = await res.json();
            
            complaintsTableBody.innerHTML = ''; // Bersihkan tabel
            
            data.complaints.forEach(complaint => {
                const row = `
                    <tr class="border-b">
                        <td class="p-2 text-sm text-muted-foreground">${complaint.id}</td>
                        <td class="p-2">${complaint.text}</td>
                    </tr>
                `;
                complaintsTableBody.innerHTML += row;
            });
        } catch (err) {
            console.error("Gagal memuat keluhan:", err);
            complaintsTableBody.innerHTML = '<tr><td colspan="2">Gagal memuat data</td></tr>';
        }
    }

    // 2. Kirim respon baru
    responseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const keyword = document.getElementById('keyword').value;
        const responseText = document.getElementById('response-text').value;

        try {
            const res = await fetch(`${API_URL}/responses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword: keyword, response: responseText })
            });

            if (res.ok) {
                alert('Respon baru berhasil disimpan!');
                responseForm.reset();
            } else {
                alert('Gagal menyimpan respon.');
            }
        } catch (err) {
            console.error("Error saat menyimpan respon:", err);
            alert('Error jaringan.');
        }
    });

    // Inisialisasi
    loadComplaints();
});