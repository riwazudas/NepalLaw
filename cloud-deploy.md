# ⚖️ NepalLaw Bilingual RAG - GCP Cloud Run Web Deployment Guide

This guide describes how to publish the **NepalLaw Bilingual RAG & Control Panel** on Google Cloud Platform (GCP) using **Google Cloud Run** entirely through the GCP Website. 

By setting up continuous deployment from your Git repository (such as GitHub), Google Cloud will automatically rebuild and redeploy your application every time you push code or updated laws. By deploying serverlessly, your website will automatically scale down to zero when not in use, making hosting costs practically **$0**!

---

## 🏗️ Deployment Architecture

Our deployment setup is fully containerized and optimized for rapid web-triggered builds and zero hosting overhead:
* **Pre-Compiled Database Deployment**: The Docker container copies the compiled `knowledge_base.json` database directly from your local `web-app/public/` folder.
* **Lightweight Uploads**: The `data/` folder (containing raw markdown source acts) is ignored by `.dockerignore`. This prevents uploading megabytes of raw files to Google Cloud Build, making your cloud deployments compile in under a minute!
* **Zero Database Overhead**: There are no external databases (e.g., PostgreSQL, MongoDB, Pinecone) to host or maintain. The Next.js API routes query the static JSON database directly from the running container, leading to lightning-fast, secure retrieval!
* **Serverless Scale-to-Zero**: Google Cloud Run hosts the container and spins up resources on-demand, charging only for active CPU and memory cycles used to process queries.

---

## 🛠️ Prerequisites

1. **Google Cloud Platform Account**: You will need a Google Cloud account with an active **billing account** attached. (Google provides a $300 free credit for new users which is more than enough to host this for years!).
2. **Git Repository**: Your project code (`NepalLaw` directory) must be pushed to a remote Git provider like **GitHub**, **GitLab**, or **Bitbucket**.

---

## 🖥️ Step-by-Step Deployment via the GCP Web Console

This method connects Google Cloud directly to your Git repository. Every time you push code to GitHub, GCP will automatically build your Docker container and redeploy your live site!

### Step 1: Open Google Cloud Run
1. Log in to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your GCP project from the top dropdown. (If you don't have one, click the dropdown and select **New Project**).
3. Search for **Cloud Run** in the top search bar and click on it.

### Step 2: Create a Cloud Run Service
1. Click the **CREATE SERVICE** button at the top of the page.
2. Under "Source", select **Continuously deploy new revisions from a source repository** (this sets up automatic GitHub triggers).
3. Click the **SET UP WITH CLOUD BUILD** button.

### Step 3: Connect your Git Repository
1. In the fly-out panel on the right, select **GitHub** (or your preferred Git provider) as the Repository Provider.
2. If this is your first time, follow the prompts to authorize Google Cloud to access your Git repositories.
3. Select your repository name (e.g., `NepalLaw`) and check the agreement box. Click **Next**.
4. Under "Branch", enter `main` (or whichever branch you push your code to).
5. Under "Build Configuration", select **Dockerfile**.
6. Set the "Source directory" path to `/Dockerfile` (leave as root `/`).
7. Click **Save**.

### Step 4: Configure Cloud Run Settings
1. **Service Name**: Enter `nepal-law-rag` (or leave as default).
2. **Region**: Choose a region close to your target audience (e.g., `us-central1` or `asia-south1` for South Asia/Nepal).
3. **CPU Allocation**: Select **CPU is only allocated during request processing** (this is the key setting that scales costs to $0 when the site is idle).
4. **Autoscaling**: Set "Minimum number of instances" to `0` (for maximum cost savings) and "Maximum number of instances" to `5` or `10`.
5. **Ingress Control**: Select **All** (to allow web traffic from the internet).
6. **Authentication**: Select **Allow unauthenticated invocations** (so anyone can visit your RAG chat website).

### Step 5: Add your Gemini API Key
1. Scroll down and expand the **Container, Volumes, Connections, Security** section at the bottom.
2. Click the **Variables & Secrets** tab.
3. Click **ADD VARIABLE**.
4. Under **Name**, enter: `GOOGLE_GENERATIVE_AI_API_KEY`
5. Under **Value**, paste your Google Gemini API Key (e.g., `AIzaSy...`).

### Step 6: Deploy!
1. Scroll to the bottom and click **CREATE**.
2. Google Cloud will automatically enable the necessary APIs (Cloud Run, Cloud Build, Artifact Registry) and trigger your first container build. You can watch the build logs in real-time.
3. Once completed (typically 1-2 minutes), GCP will display a green checkmark and provide you with a **public HTTPS URL** at the top of the page (e.g., `https://nepal-law-rag-xxxxxx.a.run.app`). 

Click the URL, and your Bilingual Law RAG chatbot is live!

---

## 🔧 Fine-Tuning Serverless Parameters in Console

You can adjust your service at any time without code changes directly on the GCP website:

### 1. Eliminating Cold Starts
By default, Cloud Run scales down to `0` instances when there's no traffic. The next visitor might experience a 4-7 second "cold start" delay. 
If you want to keep **1 instance** running at all times (costs approx. $5-$10/month if you exceed Google's generous free tiers):
1. Go to your `nepal-law-rag` service page in Cloud Run.
2. Click **Edit & Deploy New Revision**.
3. Under the **Autoscaling** section, change the "Minimum number of instances" from `0` to `1`.
4. Click **Deploy**.

### 2. Upgrading Memory/CPU
If you want to speed up retrieval and response times:
1. Go to your service page and click **Edit & Deploy New Revision**.
2. Go to the **Container** tab.
3. Increase **Memory** to `1 GiB` and **CPU** to `1` (or `2`).
4. Click **Deploy**.

---

## 🛡️ Rotating secrets
If you need to update your **Google Gemini API Key**:
1. Go to your `nepal-law-rag` service page in Cloud Run.
2. Click **Edit & Deploy New Revision**.
3. Go to the **Variables & Secrets** tab.
4. Update the value of your `GOOGLE_GENERATIVE_AI_API_KEY` environment variable.
5. Click **Deploy**.

---

## 🌐 Custom Domain Mapping
To make your bilingual law app accessible under your own custom domain (e.g., `nepallaw.yourdomain.com`):
1. Go to your **Cloud Run** console.
2. Click the **MANAGE CUSTOM DOMAINS** button at the top bar.
3. Click **ADD MAPPING**.
4. Select the `nepal-law-rag` service, enter your custom domain, and click **Continue**.
5. Google will provide you with **TXT** and **CNAME** DNS records. Log in to your domain registrar (GoDaddy, Namecheap, Cloudflare) and add these records.
6. Google will automatically provision a **free SSL Certificate** and handle renewals!

---

## ⚠️ Troubleshooting Console Errors

### Error: `Cloud Build API has not been used` or `Billing not enabled`
* **Symptom**: Deployment fails during the build step.
* **Resolution**: Go to the **Billing** section of your Google Cloud console and verify your credit card/account is active for this project, then redeploy.

### Error: `Container failed to start`
* **Symptom**: Cloud Run says the container failed to launch or listen on the correct port.
* **Resolution**: Check the **Logs** tab on your Cloud Run service page. 
  * Ensure your Gemini API Key was pasted correctly.
  * Our Dockerfile automatically handles the standard Cloud Run port configuration (`8080`), so you don't need to change any port settings.
