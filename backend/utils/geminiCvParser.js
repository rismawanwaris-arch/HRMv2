const fs = require('fs');
const path = require('path');

/**
 * Service to parse CV documents and screen candidates against HRD standards using Google Gemini API.
 */

const GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-pro-latest',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash'
].filter(Boolean);

/**
 * Call Gemini API with multimodal input (PDF/Image/Text) and get structured candidate JSON.
 * @param {Buffer} fileBuffer 
 * @param {string} mimeType 
 * @param {string} [originalFilename]
 * @returns {Promise<Object>}
 */
async function parseCvWithGemini(fileBuffer, mimeType, originalFilename = '') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi di file .env. Silakan masukkan API key Gemini Anda.');
  }

  // Normalize mime type
  let effectiveMimeType = mimeType;
  if (!effectiveMimeType || effectiveMimeType === 'application/octet-stream') {
    const ext = path.extname(originalFilename).toLowerCase();
    if (ext === '.pdf') effectiveMimeType = 'application/pdf';
    else if (ext === '.jpg' || ext === '.jpeg') effectiveMimeType = 'image/jpeg';
    else if (ext === '.png') effectiveMimeType = 'image/png';
    else if (ext === '.webp') effectiveMimeType = 'image/webp';
    else effectiveMimeType = 'application/pdf';
  }

  const base64Data = fileBuffer.toString('base64');

  const systemPrompt = `Anda adalah Asisten HRD Senior dan AI CV Parser untuk CV. Asya Bisnis Indonesia (perusahaan retail konter pulsa, aksesoris, petshop, dan gudang).

Tugas Anda:
1. Baca dan ekstrak seluruh data diri pelamar dari berkas CV yang diberikan dengan akurasi tinggi.
2. Lakukan evaluasi awal (Screening Tahap 1 - Administrasi) terhadap profil pelamar untuk posisi Frontliner / Kasir / Pramuniaga / Staff Operasional.

Kriteria Standar HRD:
- Usia Ideal: 18 s/d 25 tahun (jika tanggal lahir tidak tertulis, perkirakan dari tahun lulus sekolah/kuliah).
- Pendidikan Minimal: SMA / SMK sederajat (atau D3 / S1).
- Domisili: Wilayah operasional Bandung, Cimahi, Jawa Barat, atau bersedia ditempatkan di outlet terkait.
- Pengalaman & Keterampilan: Diutamakan pengalaman kasir, pelayanan pelanggan (customer service), retail, sales konter, atau fresh graduate yang komunikatif dan teliti.

Format Response:
Anda WAJIB memberikan output dalam bentuk JSON murni tanpa markdown pembungkus (\`\`\`json ... \`\`\`) yang mematuhi struktur berikut:
{
  "name": "Nama lengkap pelamar (huruf kapital di awal kata)",
  "nik": "Nomor KTP/NIK 16 digit jika tercantum di CV, jika tidak ada kosongkan stringnya",
  "phone": "Nomor WhatsApp/Telepon (contoh: 081234567890)",
  "email": "Alamat email pelamar",
  "gender": "Laki-laki" ATAU "Perempuan",
  "birth_place": "Kota tempat lahir jika ada",
  "birth_date": "Tanggal lahir format YYYY-MM-DD jika ada, jika hanya tahun/bulan buat perkiraan terbaik",
  "religion": "Islam" / "Kristen" / "Katolik" / "Hindu" / "Buddha" / "Lainnya",
  "marital_status": "Belum Kawin" ATAU "Kawin",
  "education_level": "SMA / SMK" / "D3" / "D4 / S1" / "S2" / "SMP",
  "education_institution": "Nama sekolah / universitas terakhir",
  "education_major": "Jurusan pendidikan (contoh: Teknik Komputer dan Jaringan, Akuntansi, Manajemen)",
  "address_ktp": "Alamat KTP jika tertulis",
  "address_domicile": "Alamat domisili atau kota tempat tinggal saat ini",
  "work_experience": "Rangkuman pengalaman kerja sebelumnya secara ringkas dan informatif (perusahaan, posisi, durasi)",
  "skills": ["Daftar keahlian teknis/soft skills, misal: Kasir POS, Microsoft Excel, Komunikasi, Pelayanan Pelanggan"],
  "assessment": {
    "match_score": 85, // Angka bulat 0 - 100 berdasarkan kesesuaian kriteria HRD
    "usia_sesuai": true, // true jika usia 18-25 tahun
    "pendidikan_sesuai": true, // true jika minimal SMA/SMK
    "domisili_sesuai": true, // true jika domisili di area kerja
    "pengalaman_relevan": true, // true jika memiliki pengalaman retail/kasir/CS atau profil fresh graduate aktif
    "berkas_lengkap": true,
    "strengths": [
      "Poin kelebihan 1",
      "Poin kelebihan 2"
    ],
    "interview_notes": [
      "Catatan hal yang perlu dikonfirmasi saat wawancara (misal: kesiapan kerja sistem shift, domisili, atau jeda kerja)"
    ],
    "recommendation": "Sangat Direkomendasikan" ATAU "Dipertimbangkan" ATAU "Kurang Sesuai",
    "summary": "Ringkasan analisis profil kandidat dalam 2-3 kalimat objektif."
  }
}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: effectiveMimeType,
              data: base64Data
            }
          },
          {
            text: systemPrompt
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1
    }
  };

  const VALID_MODEL_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
  const ALLOWED_GEMINI_HOST = 'generativelanguage.googleapis.com';
  let lastError = null;

  // Try each supported model in order
  for (const model of GEMINI_MODELS) {
    if (!VALID_MODEL_REGEX.test(String(model))) {
      console.warn('[Gemini CV Parser] Skipping invalid model identifier.');
      continue;
    }
    try {
      const urlStr = `https://${ALLOWED_GEMINI_HOST}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const parsedUrl = new URL(urlStr);
      if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== ALLOWED_GEMINI_HOST) {
        throw new Error('Blocked untrusted Gemini endpoint host.');
      }

      const response = await fetch(parsedUrl.toString(), {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errText = (await response.text()).replaceAll(apiKey, '[REDACTED]').slice(0, 200);
        console.warn(`[Gemini CV Parser] Model ${model} failed with HTTP ${response.status}: ${errText}`);
        lastError = new Error(`Gemini API request failed with HTTP ${response.status}`);
        continue; // Try next model
      }

      const result = await response.json();
      const textOutput = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOutput) {
        throw new Error('Gemini tidak memberikan respon teks.');
      }

      // Clean markdown codeblocks if model returned any
      let cleanedJson = textOutput.trim();
      if (cleanedJson.startsWith('```json')) {
        cleanedJson = cleanedJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedJson.startsWith('```')) {
        cleanedJson = cleanedJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsedData = JSON.parse(cleanedJson);
      return parsedData;
    } catch (err) {
      const safeMsg = String(err?.message || 'unknown error').replaceAll(apiKey, '[REDACTED]').slice(0, 200);
      console.warn(`[Gemini CV Parser] Exception with model ${model}: ${safeMsg}`);
      lastError = new Error('Gagal memproses CV dengan Google Gemini API.');
    }
  }

  throw lastError || new Error('Gagal memproses CV dengan Google Gemini API.');
}

module.exports = {
  parseCvWithGemini
};
