# MediKiosk Prototype (SIH26047)

MediKiosk is an AI-powered clinical history platform designed specifically for high-volume Outpatient Departments (OPDs). It provides a voice-first, multilingual intake experience that captures structured clinical data from patients while requiring zero mandatory typing. 

This repository contains the prototype built for the Smart India Hackathon (SIH) 2026.

## System Architecture

The application is built on a modular, decoupled architecture:

* **Frontend:** React application built with Vite. It manages the kiosk user interface, browser-based speech-to-text (STT) capture, and camera interactions.
* **Backend:** Python application built with FastAPI. It handles the core Adaptive Clinical Interview (ACI) engine, face recognition (via dlib), prescription OCR, and LLM integrations.
* **AI Integrations:** Integrates with Sarvam AI for regional language Text-to-Speech (TTS) and Groq for high-speed clinical reasoning.

## Key Features

* **Multilingual Voice-First Interface:** Supports natural conversation and code-switching (English, Formal Hindi, and Hinglish) using an adaptive language classifier.
* **Zero Mandatory Typing:** Designed for populations with varying digital literacy. Relies on voice capture with large, accessible touch fallbacks.
* **Face Recognition Registration:** Uses perceptual hashing and facial embeddings to securely identify returning patients and instantly pull their medical history.
* **RAG Past History:** Automatically queries previous visit records to enrich the current intake summary, preventing redundant clinical questioning.
* **Prescription OCR:** Allows patients to hold up previous prescriptions to the camera, which are analyzed and structured into medication lists using vision models.
* **Human-in-the-Loop Clinical Safety:** All AI-generated output is presented for 100% doctor review before being accepted into the clinical record.

## Getting Started (Local Development)

The project is fully containerized using Docker to ensure cross-platform compatibility (especially for the C++ dependencies required by the facial recognition libraries).

### Prerequisites
* Docker and Docker Compose
* API Keys for LLM Providers (Groq, Sarvam)

### Installation & Execution

1. Clone the repository and navigate to the project root.
2. Create environment configuration files:
   * Create `backend/.env` and add your API keys:
     ```env
     GROQ_API_KEY=your_key_here
     SARVAM_API_KEY=your_key_here
     ```
3. Build and run the containers using Docker Compose:
   ```bash
   docker compose up --build
   ```

### Accessing the Application

* **Frontend UI:** http://localhost:5173
* **Backend API:** http://localhost:8080
* **API Documentation:** http://localhost:8080/docs

## Deployment

The application is designed to be easily deployed to modern PaaS providers (such as Render or Vercel). 

**Important Deployment Note:** The `face-recognition` package requires significant memory and CPU to compile from source. When deploying to free-tier cloud instances with limited RAM (e.g., 512MB), it is recommended to omit the `face-recognition` dependency, as the backend will automatically and gracefully fall back to a lightweight perceptual hashing algorithm.

## License

Developed for Smart India Hackathon 2026. All rights reserved.
