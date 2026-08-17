# Firebase Hosting operations runbook

Request: `OPS-20260817-8E21`

Environment: `production`

Provisioned project: `riffai-booklet-prod`

Data location: `asia-southeast1` (Singapore)

## 1. Select the Google Cloud project

Firebase is enabled on a Google Cloud project. Use an existing project only
when its owner, billing account, data boundary, lifecycle, and production
purpose match this application. Do not reuse an unrelated project merely
because it is available.

The approved project ID is `riffai-booklet-prod`; use the same value for
`FIREBASE_PROJECT_ID`. Before changing it,
verify the active account and project:

```sh
gcloud auth list
gcloud projects describe "$FIREBASE_PROJECT_ID"
gcloud billing projects describe "$FIREBASE_PROJECT_ID"
```

If no current project has the correct production boundary, create a dedicated
GCP project through the normal organization and billing process, then enable
Firebase on that project. This is still a GCP project, not a separate platform.

## 2. Enable the Firebase services

Enable Firebase on the selected project and initialize its default Hosting
site. This one-time action requires an authorized project administrator. In
Firebase Console, select **Add project**, choose the existing GCP project, and
enable Hosting. Analytics is not required for this deployment. Create the
default Firestore database, enable Google Authentication, and create the Cloud
Storage bucket in the approved data region before the first deploy.

Verify that the project and Hosting site are visible before creating CI
credentials:

```sh
npx --yes firebase-tools@15.27.0 projects:list
npx --yes firebase-tools@15.27.0 hosting:sites:list \
  --project "$FIREBASE_PROJECT_ID"
```

The repository contains reviewed baseline rules for Firestore and Cloud
Storage. The production job deploys those rules with Hosting so the console and
repository cannot silently drift. Deploying the rules overwrites the active
rules for the configured default database and bucket, so the manual production
approval must include their diff.

## 3. Create the CI deployer

Create a dedicated service account; do not use a personal account or a broad
Owner credential:

```sh
DEPLOYER_NAME="gitlab-firebase-deployer"
DEPLOYER_EMAIL="${DEPLOYER_NAME}@${FIREBASE_PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create "$DEPLOYER_NAME" \
  --project "$FIREBASE_PROJECT_ID" \
  --display-name "GitLab Firebase Hosting deployer"

gcloud projects add-iam-policy-binding "$FIREBASE_PROJECT_ID" \
  --member "serviceAccount:${DEPLOYER_EMAIL}" \
  --role roles/firebasehosting.admin

gcloud projects add-iam-policy-binding "$FIREBASE_PROJECT_ID" \
  --member "serviceAccount:${DEPLOYER_EMAIL}" \
  --role roles/firebaserules.admin

gcloud projects add-iam-policy-binding "$FIREBASE_PROJECT_ID" \
  --member "serviceAccount:${DEPLOYER_EMAIL}" \
  --role roles/firebasestorage.viewer

gcloud projects add-iam-policy-binding "$FIREBASE_PROJECT_ID" \
  --member "serviceAccount:${DEPLOYER_EMAIL}" \
  --role roles/storage.bucketViewer

gcloud projects add-iam-policy-binding "$FIREBASE_PROJECT_ID" \
  --member "serviceAccount:${DEPLOYER_EMAIL}" \
  --role roles/serviceusage.apiKeysViewer

gcloud projects add-iam-policy-binding "$FIREBASE_PROJECT_ID" \
  --member "serviceAccount:${DEPLOYER_EMAIL}" \
  --role roles/serviceusage.serviceUsageConsumer
```

The organization policy disables service-account key creation. Production CI
therefore uses GitLab OIDC with Google Workload Identity Federation and
short-lived service-account impersonation. The provider accepts only project
ID `26`, branch `main`, and environment `production`; no long-lived JSON key is
created or stored in GitLab.

## 4. Configure GitLab

In **Settings → CI/CD → Variables**, add:

| Variable | Type | Controls |
| --- | --- | --- |
| `FIREBASE_PROJECT_ID` | Variable | Protected |
| `VITE_FIREBASE_API_KEY` | Variable | Protected |
| `VITE_FIREBASE_AUTH_DOMAIN` | Variable | Protected |
| `VITE_FIREBASE_PROJECT_ID` | Variable | Protected |
| `VITE_FIREBASE_STORAGE_BUCKET` | Variable | Protected |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Variable | Protected |
| `VITE_FIREBASE_APP_ID` | Variable | Protected |

Copy the `VITE_FIREBASE_*` values from **Firebase Console → Project settings →
Your apps → SDK setup and configuration**. They identify the web app and are
not server credentials; authorization is enforced by Authentication and
Security Rules.

Protect the default branch. In **Settings → CI/CD → Protected environments**,
protect `production` and restrict deployment to the approved Ops role or
group. This restriction is the production approval boundary; the pipeline job
itself is also a blocking manual action.

## 5. Provision the first administrator

Authorization for the admin panel is enforced by the Firebase Authentication
custom claim `admin: true`, not by a Firestore document. Firestore/Storage
Security Rules check `request.auth.token.admin == true`; a signed-in Google
account with no such claim is denied, regardless of any Firestore record.

The `addAdminClaim` and `removeAdminClaim` Cloud Functions (deployed from
`functions/`) grant and revoke this claim, but both require the caller to
already hold `admin: true` — there is no admin yet to authorize the first
one through them. Seed the first admin from a trusted administrative
environment with the Firebase Admin SDK or `gcloud` identity that has
`roles/firebaseauth.admin` (or broader) on the project:

```sh
# The target user must have signed in with Google at least once already,
# so a Firebase Auth user record exists to attach the claim to.
node -e "
  const { initializeApp } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');
  initializeApp();
  getAuth().getUserByEmail('APPROVED_ADMIN_EMAIL')
    .then((user) => getAuth().setCustomUserClaims(user.uid, { admin: true }))
    .then(() => console.log('done'));
"
```

Run this once, from a machine authenticated as an account with the
Firebase Admin SDK default credentials for `riffai-booklet-prod` (for
example via `gcloud auth application-default login` with an account that
has `roles/firebaseauth.admin`). Do not grant this claim to consumer
accounts or all authenticated users.

After the first admin is seeded, every subsequent admin can be added or
removed directly from the admin panel (**Admin → จัดการ Admin**), which
calls `addAdminClaim`/`removeAdminClaim` — no further manual Admin SDK
access is needed unless the last remaining admin is locked out.

The Firestore `admins` collection is only a read-only mirror (written
exclusively by the two Cloud Functions) used to list current admins in the
panel UI; it does not grant any access on its own.

**Pipeline gap:** `deploy_production` currently runs
`firebase deploy --only hosting,firestore:rules,storage`, which does not
include `functions`. The `addAdminClaim`/`removeAdminClaim` Cloud Functions
in `functions/` must be added to that `--only` list (or deployed once
manually with `npx firebase-tools@15.27.0 deploy --only functions --project
riffai-booklet-prod`) before the admin panel's "จัดการ Admin" tab will work
in production. The CI deployer service account also needs
`roles/cloudfunctions.developer` (or equivalent) added alongside the roles
already granted in Section 3, since Cloud Functions deployment is a
separate IAM surface from Hosting/Firestore/Storage.

## 6. Deploy and verify

1. Merge an approved change into the default branch.
2. Confirm the `build` job completed and retained the `docs/` artifact.
3. Review the commit SHA and change owner.
4. An authorized operator starts `deploy_production` manually.
5. Verify the URL shown on the GitLab environment and test the viewer on a
   clean browser session.
6. Sign in as the approved admin, upload a small PDF, verify its public viewer
   URL, then remove the test record and object.
7. Confirm that a normal authenticated user cannot create, update, or delete
   booklet data.
8. Confirm that no service-account JSON file appears in job artifacts or logs.

## 7. Roll back

In **Firebase Console → Hosting → Release history**, select the last known-good
release and choose **Rollback**. Then verify the public URL and record the
failed and restored release identifiers in the incident or Ops request.

Hosting rollback does not restore Firestore or Cloud Storage data or their
rules. Restore a prior rules commit through the same reviewed manual pipeline.
Define separate data backup and recovery procedures before the admin feature
goes live.
