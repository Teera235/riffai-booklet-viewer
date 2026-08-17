# riffai-booklet-viewer

## Firebase Hosting deployment

Firebase services are enabled inside a Google Cloud project. This repository
does not require a separate project type or a hard-coded project ID: Ops selects
an existing, workload-appropriate GCP project and supplies its ID through
GitLab CI/CD variables.

GitLab CI runs `npm run build` for branch and merge-request pipelines. On the
default branch, the `deploy_production` job becomes available as a blocking
manual action after the build succeeds.

Configure these GitLab CI/CD variables before the first production deployment:

- `FIREBASE_PROJECT_ID`: Firebase project ID. Mark it **Protected**.
- `FIREBASE_SERVICE_ACCOUNT_KEY`: service-account JSON, preferably a GitLab
  **File** variable. Mark it **Masked** and **Protected**. A regular JSON variable
  is also supported.

The service account needs only the permissions required to deploy Firebase
Hosting. Protect the `production` environment in GitLab so only approved
operators can start the manual deploy job.

The pipeline deploys Hosting only. Provision Firebase Authentication,
Firestore, and Cloud Storage separately, and review their access rules before
enabling the planned admin upload functionality.

Rollback is performed from **Firebase Console → Hosting → Release history** by
selecting the previous known-good release; rebuilding the application is not
required.

See [operations/firebase-hosting-runbook.md](operations/firebase-hosting-runbook.md)
for project selection, IAM, CI/CD variable setup, approval, validation, and
rollback procedures.
