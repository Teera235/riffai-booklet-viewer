# Firebase Hosting operations runbook

Request: `OPS-20260817-8E21`

Environment: `production`

## 1. Select the Google Cloud project

Firebase is enabled on a Google Cloud project. Use an existing project only
when its owner, billing account, data boundary, lifecycle, and production
purpose match this application. Do not reuse an unrelated project merely
because it is available.

Record the approved project ID as `FIREBASE_PROJECT_ID`. Before changing it,
verify the active account and project:

```sh
gcloud auth list
gcloud projects describe "$FIREBASE_PROJECT_ID"
gcloud billing projects describe "$FIREBASE_PROJECT_ID"
```

If no current project has the correct production boundary, create a dedicated
GCP project through the normal organization and billing process, then enable
Firebase on that project. This is still a GCP project, not a separate platform.

## 2. Enable Firebase Hosting

Enable Firebase on the selected project and initialize its default Hosting
site. This one-time action requires an authorized project administrator. In
Firebase Console, select **Add project**, choose the existing GCP project, and
enable Hosting. Analytics is not required for this deployment.

Verify that the project and Hosting site are visible before creating CI
credentials:

```sh
npx --yes firebase-tools@15.27.0 projects:list
npx --yes firebase-tools@15.27.0 hosting:sites:list \
  --project "$FIREBASE_PROJECT_ID"
```

Firestore, Authentication, and Cloud Storage are application prerequisites for
the planned admin upload feature. Provision them only after the application
team supplies reviewed data models, identity providers, and security rules.
This pipeline intentionally deploys Hosting only.

## 3. Create the CI deployer

Create a dedicated service account; do not use a personal account or a broad
Owner credential:

```sh
DEPLOYER_NAME="gitlab-firebase-hosting-deployer"
DEPLOYER_EMAIL="${DEPLOYER_NAME}@${FIREBASE_PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create "$DEPLOYER_NAME" \
  --project "$FIREBASE_PROJECT_ID" \
  --display-name "GitLab Firebase Hosting deployer"

gcloud projects add-iam-policy-binding "$FIREBASE_PROJECT_ID" \
  --member "serviceAccount:${DEPLOYER_EMAIL}" \
  --role roles/firebasehosting.admin

gcloud projects add-iam-policy-binding "$FIREBASE_PROJECT_ID" \
  --member "serviceAccount:${DEPLOYER_EMAIL}" \
  --role roles/serviceusage.serviceUsageConsumer
```

The request currently specifies a service-account JSON key. Generate it only
after the project and roles are approved, store it directly as a protected
GitLab **File** variable, and remove the local copy. Prefer GitLab workload
identity federation in a follow-up change so a long-lived key is unnecessary.

## 4. Configure GitLab

In **Settings → CI/CD → Variables**, add:

| Variable | Type | Controls |
| --- | --- | --- |
| `FIREBASE_PROJECT_ID` | Variable | Protected |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | File | Protected and masked/hidden where supported |

Protect the default branch. In **Settings → CI/CD → Protected environments**,
protect `production` and restrict deployment to the approved Ops role or
group. This restriction is the production approval boundary; the pipeline job
itself is also a blocking manual action.

## 5. Deploy and verify

1. Merge an approved change into the default branch.
2. Confirm the `build` job completed and retained the `docs/` artifact.
3. Review the commit SHA and change owner.
4. An authorized operator starts `deploy_production` manually.
5. Verify the URL shown on the GitLab environment and test the viewer on a
   clean browser session.
6. Confirm that no service-account JSON file appears in job artifacts or logs.

## 6. Roll back

In **Firebase Console → Hosting → Release history**, select the last known-good
release and choose **Rollback**. Then verify the public URL and record the
failed and restored release identifiers in the incident or Ops request.

Rollback does not restore Firestore or Cloud Storage data. Those services are
outside this Hosting-only deployment and require separate backup and recovery
procedures before the admin feature goes live.
