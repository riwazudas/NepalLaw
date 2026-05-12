# ⚖️ NepalLaw Bilingual RAG & Control Panel

[![GCP Deployment](https://img.shields.io/badge/GCP-Cloud_Run-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white)](https://nepal-law-719750440273.asia-southeast3.run.app/)
[![Live Application](https://img.shields.io/badge/Live_App-Active-success?style=for-the-badge)](https://nepal-law-719750440273.asia-southeast3.run.app/)

🌐 **Deployed Live URL**: [https://nepal-law-719750440273.asia-southeast3.run.app/](https://nepal-law-719750440273.asia-southeast3.run.app/)

Welcome to the **NepalLaw Bilingual RAG & Control Panel** repository! This is an advanced, high-performance legal RAG (Retrieval-Augmented Generation) platform and audit suite designed to extract, align, heal, and query Nepalese legislative acts in both **English** and **Nepali**.

The project features automated crawlers/scrapers, sequential document combination utilities, an automated integrity audit center, an AI-powered self-healing pipeline, and a beautiful interactive workspace chatbot.

---

## 📂 Project Architecture

The workspace is organized into three major layers:

```
├── data/
│   ├── laws/              # Raw sequentially structured Markdown files (English/Nepali)
│   ├── laws_json/         # Combined source-of-truth bilingual JSON files per act
│   └── laws_audit_report.md # Automatically generated integrity and parity score report
├── scrapper/              # Modular Python crawlers for Nepal Wordpress API/HTML extraction
└── web-app/               # Next.js 16 (Turbopack) Chatbot workspace & control panel
```

### 1. `data/` (Bilingual Legislative Corpus)
- **`data/laws/`**: Houses the raw, sequentially structured Markdown files extracted from legislative platforms (divided into `*_english.md` and `*_nepali.md` pairs).
- **`data/laws_json/`**: The permanent source-of-truth database of clean bilingual acts. Each file (e.g., `companies_act_2063.json`) contains a single `LawAct` array consisting of deeply mapped, aligned, bilingual section objects.
- **`data/laws_audit_report.md`**: An automatically generated integrity report tracking the alignment score and missing fields of every single legislative act in the database.

### 2. `scrapper/` (Legislative Scraping Utilities)
- Contains modular Python script crawlers targeting the official Nepal WordPress API and fallback HTML endpoints.
- Features tools for automated law ID discovery, header parsing, conversion from HTML to Markdown, and document segment compilation.

### 3. `web-app/` (Next.js 16 RAG Control Panel)
- **Interactive Chatbot Workspace**: A state-of-the-art chat interface for querying the laws with dual-language context expansion (BM25/TF-IDF scoring + bilingual glossary expansion + Gemini context re-ranking).
- **Control Panel Dashboard**: An administrative portal for initiating audits, visualizing coverage statistics, and repairing broken references or missing translations.

---

## 🚀 Key System Features

| Feature | Description | Core Engine / Tech |
| :--- | :--- | :--- |
| **Hybrid RAG Retriever** | BM25/TF-IDF scoring engine coupled with dual-language query expansion. | `retrieval.ts` |
| **Bilingual Glossary Expansion** | Automatically expands terms between English and Nepali to ensure semantic alignment. | `BILINGUAL_GLOSSARY` |
| **Contextual Re-Ranking**| Leverages Gemini 3.1 Flash-Lite to score and re-rank candidate blocks for absolute retrieval accuracy. | Google Generative AI SDK |
| **Admin Audit Diagnostic Center** | Scans legislative json records to identify bilingual translation gaps, broken cross-references, or truncated blocks. | `audit_laws.ts` |
| **Granular AI Self-Healer** | Refactored pipeline to perform translation and cross-reference fixes **one entry at a time**, directly committing updates to individual JSON files in `laws_json` and syncing them to the database on disk. | `self_healing.ts` |

---

## 🛠️ Getting Started

### 1. Prerequisites
Ensure you have the following installed on your system:
- [Node.js (v18+)](https://nodejs.org/)
- [Python (3.9+)](https://www.python.org/)
- Google Gemini API Key

---

### 2. Setting Up the Web Application

1. Navigate to the `web-app` directory:
   ```bash
   cd web-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` configuration file:
   ```env
   GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key-here
   ```

4. Run the Next.js development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the chatbot workspace, and [http://localhost:3000/admin](http://localhost:3000/admin) to view the Knowledge Brain control panel.

---

### 3. Running Administrative Scripts

From the `web-app` directory, you can run the following commands to manage the database structures:

| Command | Action | Output File |
| :--- | :--- | :--- |
| `npm run ingest` | Ingests raw markdown files from `data/laws/` and compiles them into `public/knowledge_base.json`. | `web-app/public/knowledge_base.json` |
| `npm run combine-acts` | Pairs and combines Markdown file languages sequentially into clean bilingual JSON entries. | `data/laws_json/*.json` |
| `npm run audit-acts` | Audits the alignment of the JSON database and generates a parity score report. | `data/laws_audit_report.md` |

---

## 🧬 Automated AI Self-Healing System

When parsing hundreds of legislative sections, minor structural or translation anomalies are inevitable. The system includes an automated **AI Self-Healing Pipeline**:

1. **Diagnostics Audit**:
   Administrators run diagnostic scans via the Control Panel tab or `npm run audit-acts` to identify translation gaps (where a section has English text but is missing its Nepali counterpart, or vice versa) or broken cross-references.
   
2. **Granular Self-Healing**:
   When **Self-Heal** is triggered for a specific issue, the agent performs a lightweight, granular operation:
   - It targets exactly the single JSON file (e.g., `bonus_act_2030.json`) under `data/laws_json/`.
   - It performs standard translation (via formal legal vocabulary translation prompts) or corrects broken section references.
   - It saves the updated act back to the individual JSON file (with automatic backup under `data/laws_json/.backup/`).
   - It syncs the updated block directly into the runtime `public/knowledge_base.json` on disk, allowing immediate testing in the Chat playground without any slow bulk compilation scripts.

---

## 📜 License & Acknowledgements

This workspace was custom-engineered to simplify interaction with bilingual Nepalese legislative bodies. Powered by **Next.js**, **Tailwind CSS**, **Lucide React**, and **Google Gemini**.
