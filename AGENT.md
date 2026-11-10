# AgriSkills Passport — Agent Development Guide

> **Project:** A2 · AgriSkills Passport  
> **Programme:** TUT 4IR Research Lab · WIL Full-Stack Programme · Semester 2  
> **Delivery mode:** Individual student, core demonstrable slice  
> **Status:** Requirements baseline; verify repository and prototype before implementation.

## 1. Purpose

AgriSkills Passport is a learner-controlled digital record of qualifications, microcredentials, skills, experience, and Recognition of Prior Learning (RPL) evidence. A learner can share one credential or a curated profile through a link or QR code. An employer can open the public verification page without an account and see whether the shared credential's integrity and status are valid, without contacting the issuer.

The product should be mobile-first and usable on an Android/iOS device. The selected implementation is an **Expo + React Native application using TypeScript and NativeWind**, with a separate **Node.js + Express + TypeScript API** and **Neon PostgreSQL** database. The first version uses local authentication and mock integration adapters for AgriProvider, AgriLearn, and MyAgriSETA.

## 2. Source-of-truth and evidence rules

Use these sources in this order:
1. Existing repository code, package manifests, migrations, tests, and environment examples.
2. The supplied Figma Make prototype: https://www.figma.com/make/a22hLTKdtkV7E6jNUv4izb/Interactive-Credential-Wallet-Prototype?t=9WRxZak7aglFc61v-1
3. The TUT Semester 2 Project Proposal and A2 AgriSkills Passport brief supplied by the project owner.
4. This document for decisions already confirmed below.
5. Any assumptions explicitly recorded in `docs/requirements.md` or an ADR.

The Figma link could not be inspected by the assistant's web retrieval. **The coding agent must attempt to open it in its available browser or Figma integration.** If access is blocked, do not invent screen details. Ask the owner for screenshots/exported frames or continue with a clearly labelled provisional design and record the gap.

Do not silently change the brief or “correct” its terminology. Distinguish:
- **Confirmed:** directly stated by the owner or source material.
- **Proposed:** sensible implementation detail that needs owner confirmation.
- **Unavailable:** depends on access, credentials, external API documentation, or a design asset not supplied.

Never claim that an external integration, credential signature, deployment, test, or standards compliance works unless verified.

## 3. Confirmed project decisions

- Mobile client: Expo + React Native.
- Language: TypeScript.
- Styling: NativeWind.
- API: Node.js + Express + TypeScript.
- Database: Neon PostgreSQL.
- ORM/migrations: Prisma, unless the existing repository establishes a compatible alternative that must be preserved.
- Authentication: local registration/login for the student prototype.
- Roles in the first version: `LEARNER`, `EMPLOYER`, `ISSUER`.
- External integrations: mock adapters only; no real AgriProvider, AgriLearn, or MyAgriSETA API calls in this version.
- Credential/evidence file storage: cloud object storage using a provider adapter. Do not assume a provider or invent credentials; inspect existing configuration and ask the owner before selecting a production provider. Local development can use a documented development adapter if needed.
- Offline support: basic, including app install/run support appropriate to Expo, and locally cached non-sensitive credential summaries only.
- Individual project: prioritise a complete, testable core slice over broad incomplete functionality.
- Do not include Cloudify.
- Existing top-level folders are `mobile/`, `server/`, and `docs/`. Preserve them and inspect their contents before creating or moving files.
- Render is the intended API deployment platform and Neon is the intended database service, based on the original project setup. Confirm current repository configuration before changing deployment settings.
- Do not add an administrator role to the initial role set unless the owner explicitly approves it. Operational database administration is not the same as an in-app admin role.

## 4. Product goals

1. Let a learner sign in and view a passport.
2. Let a learner view credential details, including issuer and issue date.
3. Let a learner share one credential or a curated profile through a secure link and QR code.
4. Let an unauthenticated employer open a public verification page and see a clear result.
5. Let a learner capture RPL evidence using a photo, note, optional location stamp, and supervisor attestation fields.
6. Provide a credential issue API for providers/learning systems, represented by mock integrations in this version.
7. Support basic offline access to non-sensitive credential summary fields.
8. Deliver test evidence, setup documentation, API documentation, security notes, deployment instructions, and a handover/runbook.

## 5. Scope

### In scope for the individual core slice

- Mobile-first Expo application, TypeScript, NativeWind.
- Authentication screens and local account registration/login.
- Role-aware navigation for learner, employer/verifier, and issuer.
- Learner passport profile.
- Credential list and credential detail.
- Credential status and issuer metadata.
- Create/revoke/expire share links according to explicit rules.
- QR code representation of a public share URL.
- Public verification route/page or API response that requires no login.
- Verification result that checks stored status and credential signature/integrity.
- Basic RPL evidence form: photo capture or selection where supported, note, optional geolocation stamp with permission, supervisor attestation details.
- Secure API, persistence, validation, authorization, and error handling.
- Neon PostgreSQL schema and repeatable Prisma migrations.
- Mock adapter interfaces and seeded synthetic demo data for external systems.
- Basic offline cache of non-sensitive credential summary data; clearly show when data is cached/stale.
- Unit/integration tests for critical business rules and API access controls.
- OpenAPI specification or equivalent documented API contract.
- Deployment-ready configuration for Render API and Neon database, without committing secrets.
- `README.md`, `.env.example` files, requirements, testing notes, known limitations, and operational runbook in `docs/`.

### Out of scope unless explicitly approved

- Real integrations with AgriProvider, AgriLearn, or MyAgriSETA.
- Production government/AgriSETA identity federation or single sign-on.
- Claiming W3C Verifiable Credentials or Open Badges 3.0 compliance.
- Blockchain, public ledger, cryptocurrency, or NFT credentials.
- Legal accreditation decisions or automated qualification equivalence decisions.
- Automated RPL assessment or AI-based eligibility decisions.
- Payments, subscriptions, employment marketplace, job applications, messaging, or social network.
- Full multi-device offline conflict resolution or background upload queue.
- Storing sensitive full credential documents unencrypted in general-purpose client storage.
- Production app-store release, unless explicitly added to scope.
- A separate web dashboard unless required by the Figma prototype or owner.
- Cloudify.
- In-app administrator role in the initial version, unless approved.

## 6. Required user journeys

### Golden journey — mandatory acceptance path

1. Learner registers or signs in.
2. Learner opens their passport.
3. Learner opens a credential and reviews issuer/date/status.
4. Learner creates a share link for that credential (or an explicitly supported curated profile).
5. App presents the link and QR code.
6. Employer opens the public link or scans the QR code without signing in.
7. Verification service validates the token, credential status, and signature/integrity, then displays a clear verified/invalid/expired/revoked result.

### RPL evidence journey

1. Learner opens RPL evidence capture.
2. Learner adds a note and evidence photo.
3. App requests camera/media permission only when needed.
4. Learner may consent to adding a location stamp; do not collect location silently.
5. Learner records supervisor attestation details or marks attestation as pending.
6. API validates metadata and stores a private evidence object reference.
7. Learner can view the evidence record and its review status.

### Issuer journey

1. Issuer signs in.
2. Issuer submits a credential through a validated issuer endpoint or interface.
3. API validates issuer role and payload.
4. API creates a credential and signs a canonical representation using a server-side secret/private key.
5. Learner can see the issued credential in their passport.
6. Public verification checks integrity and current status.

If full issuer self-service cannot fit the individual scope, keep the API and a minimal issuer screen working; do not simulate successful issuance only in client state.

## 7. Functional requirements

Use stable IDs in `docs/requirements.md`; suggested IDs:

- **FR-01 Authentication:** register, login, logout, and retrieve current account.
- **FR-02 Role access:** enforce roles in the API, not only in UI navigation.
- **FR-03 Passport:** learner can retrieve their own passport and associated credentials.
- **FR-04 Credential detail:** show title/type, issuer, issue date, expiry date when applicable, status, skills/metadata, and evidence/source reference where appropriate.
- **FR-05 Issuance:** authorised issuer can issue a credential for a learner; validate and persist it.
- **FR-06 Signature/integrity:** credentials have a server-generated signature or equivalent verifiable integrity proof; signing material never reaches the mobile client.
- **FR-07 Sharing:** learner can create a cryptographically unpredictable share token with optional expiry and revocation.
- **FR-08 Public verification:** public endpoint validates share token, share expiry/revocation, credential status, and integrity without exposing unrelated personal data.
- **FR-09 QR/share:** QR encodes the public verification URL; use native share sheet where available.
- **FR-10 RPL evidence:** capture note, photo object reference, optional location/consent timestamp, supervisor attestation and review state.
- **FR-11 Offline summary:** cache only non-sensitive fields and indicate that offline information may be stale; verification always requires a live server check.
- **FR-12 Audit:** record verification events with minimal metadata and retention rules.
- **FR-13 Integration adapters:** mock provider, learning and identity adapter contracts, clearly marked as mock.
- **FR-14 Errors and loading:** show accessible loading, empty, validation, network, and permission-denied states.
- **FR-15 Documentation:** provide setup, API, security, testing, deployment, limitations and handover instructions.

## 8. Proposed data model

Inspect existing schema before implementing. Adapt names and relationships to existing migrations instead of duplicating tables.

### User
- `id` (UUID or existing project ID strategy)
- `fullName`
- `email` (unique, normalized)
- `passwordHash` (never store plaintext)
- `role` (`LEARNER`, `EMPLOYER`, `ISSUER`)
- `createdAt`, `updatedAt`
- `status` if account lifecycle is needed

### Passport
- `id`
- `ownerUserId` (unique or appropriately constrained)
- `summary` / profile fields only as required
- `createdAt`, `updatedAt`

### Credential
- `id`
- `passportId`
- `issuerUserId` or issuer organisation reference
- `title`, `credentialType`
- `description` / `skills` structured fields
- `issuedAt`, optional `expiresAt`
- `status` (for example `ACTIVE`, `REVOKED`, `EXPIRED`; expiry may also be derived from `expiresAt`)
- canonical signed payload or fields needed to reconstruct it deterministically
- `signature`, `signatureAlgorithm`, `keyId` or version marker
- optional source/external reference for mocked integration
- `createdAt`, `updatedAt`

### ShareLink
- `id`
- `credentialId` nullable if curated profile sharing is implemented; otherwise make one-credential sharing the core.
- `passportId` nullable only when profile sharing is supported.
- `tokenHash` (prefer storing a hash of the random token, not the raw bearer token)
- `createdByUserId`
- `expiresAt` nullable if non-expiring links are intentionally supported
- `revokedAt`
- `createdAt`
- Never expose internal database IDs as the sole security control.

### RplEvidence
- `id`
- `learnerUserId`
- `note`
- `objectKey` / private storage reference (not a public bucket URL)
- optional `locationLatitude`, `locationLongitude`, `locationCapturedAt`, and consent indicator; location is optional and collected only with explicit permission
- supervisor name/contact or identifier only if needed and approved; otherwise use minimal attestation fields
- `attestationStatus` and `reviewStatus`
- `createdAt`, `updatedAt`

### VerificationLog
- `id`
- `shareLinkId` and/or `credentialId`
- `result` (verified, invalid, expired, revoked, unavailable)
- `verifiedAt`
- minimal request metadata where justified; avoid retaining full IP addresses or user-agent data unless there is a documented need and retention policy.

### Optional entities
- `IssuerOrganisation` if issuers represent organisations rather than individual issuer accounts.
- `CredentialSkill` join model if skills need independent querying.
- `RefreshSession` or session table if server-managed sessions are selected.
- `IntegrationEvent` only if useful to demonstrate mock event consumption.

All relations need appropriate foreign keys, uniqueness, indexes, deletion behavior and migration coverage. Use UTC timestamps. Avoid collecting personal information that is not needed for the stated purpose.

## 9. API contract baseline

Use `/api/v1` prefix unless existing repository conventions differ. Produce an OpenAPI file and keep it aligned with actual implementation.

### Authentication
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout` if server-managed sessions/tokens require it
- `GET /api/v1/auth/me`

### Passport and credentials
- `GET /api/v1/passport/me`
- `GET /api/v1/passport/me/credentials`
- `GET /api/v1/credentials/:credentialId`
- `POST /api/v1/issuer/credentials` — issuer-only issue endpoint
- `PATCH /api/v1/issuer/credentials/:credentialId/status` — issuer-only status change/revocation, with explicit policy

### Sharing and verification
- `POST /api/v1/credentials/:credentialId/share-links`
- `GET /api/v1/share/:token` — public share metadata and verification result
- `DELETE /api/v1/share-links/:shareLinkId` — owner-only revocation
- Optional `POST /api/v1/passport/me/share-links` for curated profile sharing, if included.

### RPL evidence
- `POST /api/v1/rpl-evidence/upload-url` — authenticated learner requests short-lived upload permission, if provider supports presigned uploads
- `POST /api/v1/rpl-evidence` — save evidence metadata after upload
- `GET /api/v1/rpl-evidence`
- `GET /api/v1/rpl-evidence/:evidenceId`

### Health
- `GET /health` or existing health convention; return no secrets or infrastructure internals.

For every endpoint document: auth requirement, roles, request schema, response schema, status codes, validation failures, rate limits, and whether data is public. Do not add an endpoint to docs unless it exists or is explicitly labelled planned.

## 10. Credential signing and verification

Implement a simple, documented integrity scheme suitable for a student prototype. It must be server-side and deterministic.

- Choose an established cryptographic library and algorithm appropriate to the implementation; do not design a custom algorithm.
- Sign a canonical serialization of the credential's security-relevant fields, including a version/schema marker.
- Keep signing secrets/private keys in server environment configuration or a secret manager, never in source control, app bundle, logs, or database plaintext unless the design specifically justifies secure key storage.
- Public verification reconstructs the same canonical payload and verifies the signature, then checks revocation/expiry/current status.
- Include key/version identification so future key rotation can be documented.
- Fail closed if the signature is missing, invalid, or cannot be checked.
- Document that this is a simplified project implementation, not W3C Verifiable Credentials or Open Badges 3.0 compliance.
- Test tampering, revoked credentials, expired share tokens, revoked links, malformed tokens and unknown credentials.

## 11. Security, privacy and POPIA

This is a student prototype; document limitations and do not represent it as a formal legal compliance certification.

- Minimise personal data and state the purpose for every collected field.
- Use synthetic demo data only unless the owner and institution authorise another approach.
- Hash passwords with a suitable password-hashing algorithm and parameters; never log passwords.
- Validate all request data server-side with schemas.
- Enforce ownership and role checks in API middleware/service functions.
- Protect login and public verification endpoints with appropriate rate limiting.
- Use secure, HTTP-only, same-site cookies if cookie sessions are selected; if bearer tokens are selected, define expiry, storage, refresh and revocation strategy. Do not store long-lived credentials in insecure plaintext client storage.
- Use TLS in production.
- Keep secrets out of Git; provide `.env.example` with placeholder values only.
- Use restrictive CORS allowlists, Helmet/security headers, safe error responses and parameterised ORM queries.
- Restrict public verification to the minimum necessary fields. Do not reveal the learner's full passport or evidence photos through a credential share link.
- Use random, high-entropy share tokens; store token hashes where practical; support revocation and expiry.
- Keep evidence objects private; use short-lived signed URLs and verify user ownership before issuing them.
- Request camera, media and location permissions at point of use; explain why. Location must be optional.
- Cache only non-sensitive credential summary fields. Do not cache evidence images, private notes, auth tokens or full personal records for offline use.
- Treat verification logs as personal data if they can identify a person; minimise fields and document retention/deletion.
- Document retention, account deletion/export approach, incident handling, backups and access boundaries.
- Do not put sensitive data in analytics, crash reports, URLs, QR payloads or logs.
- Include accessibility basics: readable contrast, screen-reader labels, focus/navigation support where platform permits, and clear status text.

## 12. Mobile architecture and NativeWind

- Expo + React Native + TypeScript in `mobile/`.
- Use Expo Router if not contradicted by existing app architecture; otherwise preserve the existing router.
- Configure NativeWind according to the installed Expo, React Native, Tailwind and NativeWind versions. Follow current compatible setup; do not copy configuration blindly from a different major version.
- Keep screens, reusable UI components, API client, schemas/types, hooks, and storage utilities separated.
- Keep API base URL in environment configuration. Never hardcode localhost as the production API.
- Use a typed API client and consistent error parsing.
- Use platform APIs via Expo-compatible modules for camera/media, sharing and QR generation/scanning where needed.
- QR scanning by employer is a stretch goal; the mandatory flow can open a share URL from the QR using the device camera.
- Offline mode: cache safe summary fields; clearly indicate cached state and require online verification for a current trusted result.
- Avoid adding dependencies without a reason; verify compatibility with Expo before installing.

## 13. Backend architecture

- Express + TypeScript in `server/`.
- Separate route/controller, validation, service/domain logic, data access, authentication/authorization, and integration adapters.
- Use Prisma and Neon PostgreSQL unless existing project files establish a compatible choice that should be preserved.
- Centralise error handling; do not leak stack traces or database details to clients in production.
- Validate environment variables at startup and fail with a clear, secret-free error.
- Provide health checks and graceful shutdown.
- Use migrations; never use destructive schema reset commands against a shared or production database.
- Keep mock integrations behind interfaces so real integrations can be added later without rewriting domain logic.
- Include request correlation IDs if feasible, without logging sensitive payloads.

## 14. Cloud storage and deployment

- Do not assume a specific cloud object-storage vendor. Inspect existing files and available accounts/configuration, then document the selected provider and required environment variables. If no provider is available, implement a storage interface plus a local development adapter and mark production uploads as not configured; do not pretend uploads work in production.
- Use private buckets/containers and short-lived signed upload/download URLs where supported.
- API deployment target: Render, based on the project owner's stated plan. Database: Neon PostgreSQL.
- Mobile build/distribution: Expo development build/Expo Go for development as supported by chosen dependencies; production distribution is outside the core slice unless approved.
- Configure production API URL and allowed origins explicitly.
- Document build/start commands, health-check path, database migration release step, backups and rollback strategy.
- Keep `.env`, private keys, production URLs containing secrets, and provider credentials out of Git.
- Provide `.env.example` files for `mobile/` and `server/` without real values.
- Do not claim deployment succeeded until a live health check and a real golden-journey test have passed.

## 15. Testing and quality gates

Required automated tests:
- Auth registration/login and invalid credentials.
- Password hashes are not returned.
- Role restrictions for learner and issuer operations.
- Learner cannot access another learner's passport/evidence/share-link management.
- Issuer can issue credentials only for allowed target records.
- Signature is valid for unchanged credential data and invalid after tampering.
- Public verification does not require login and does not reveal unrelated personal data.
- Expired/revoked share link and revoked/expired credential return correct statuses.
- RPL evidence validation and private ownership checks.
- Input validation, error handling and rate limiting on critical endpoints.
- Migration/schema validation.
- Mobile golden journey and network/offline/error states, manually or with a suitable UI test tool.

Before finishing any work:
1. Inspect scripts and package manager lockfiles; do not assume npm/pnpm/yarn.
2. Run the available formatter/linter, TypeScript checks, tests, and production/build checks.
3. Report exactly what passed, failed, or could not be run.
4. Never claim tests passed if they were not run.
5. Fix regressions introduced by the change.
6. Update OpenAPI and documentation whenever API behavior changes.

## 16. Documentation deliverables

Keep documentation in `docs/` and add/update, as appropriate:
- `AGENT.md` — this guide.
- `requirements.md` — functional/non-functional requirements and acceptance criteria.
- `architecture.md` — components, trust boundaries, data flows and architecture decisions.
- `data-model.md` — entities, relations, constraints and retention.
- `api/openapi.yaml` or existing OpenAPI location.
- `security-and-popia.md` — data inventory, access, consent, retention and limitations.
- `testing.md` — test plan and results.
- `deployment-runbook.md` — Render, Neon, storage configuration, migrations, health checks and rollback.
- `known-limitations.md` — mock integrations, standards limitations, unavailable storage configuration, offline limitations.
- `decisions/` — short ADRs for important choices.

Do not create empty documents merely to appear complete. Populate them with accurate content or mark them as planned.

## 17. Individual-project delivery priority

**P0 — must work:** app boots; authentication; learner passport; credential detail; issuer can create a credential; secure share URL/QR; public verification with real signature/status checks; persistence; core tests; setup instructions.

**P1 — include if feasible without endangering P0:** RPL photo evidence and optional geolocation; private cloud storage integration; basic offline cache; issuer management polish; verification audit log; stronger accessibility polish.

**P2 — explicitly deferred:** real external integrations, full W3C/Open Badges implementation, employer QR scanner inside the app, advanced offline sync, app-store production release, extra web dashboard.

The actual scope commitment must be recorded in `docs/requirements.md` and should match the individual-project agreement in the TUT proposal.

## 18. Agent operating rules

Before editing:
1. List and inspect files under `mobile/`, `server/`, and `docs/`; inspect root manifests, lockfiles, `.gitignore`, environment examples, tests, migrations and README.
2. Identify framework/library versions and existing conventions.
3. Inspect the Figma prototype if possible; capture screen names, navigation, visual tokens and interaction states in a design audit. If unavailable, record that fact.
4. Summarise current state, gaps, and a short implementation plan.
5. Do not replace the project with a fresh scaffold if a working implementation exists.

While editing:
- Make small, coherent changes.
- Preserve unrelated working behavior.
- Do not commit secrets or real personal information.
- Never run destructive database commands without explicit approval and a safe backup/verification plan.
- Do not fabricate API credentials, external API responses, Figma screen details, deployment status or test results.
- If a decision materially affects security, cost, schema compatibility or scope, ask the owner or record a reversible proposal before proceeding.
- Keep comments useful and concise; write code the student can explain in a viva.

At completion, report:
- files created/changed;
- functionality implemented;
- commands/tests run and actual results;
- migrations added and whether they were applied (never imply applied unless verified);
- environment variables still required;
- deployment state and any manual steps;
- known limitations and next recommended task.
