// Publishes an EAS-built APK as the latest GitHub Release, so
// https://github.com/<repo>/releases/latest/download/campus-bites.apk always serves the newest build.
// Run by .eas/workflows/build-android-on-push.yml after the build job:
//   node scripts/publish-github-release.mjs <path-to-apk>
// Env: GITHUB_RELEASE_TOKEN (fine-grained token, this repo, Contents: read & write; EAS secret),
//      BUILD_ID, COMMIT, APP_VERSION (from the build job), GITHUB_REPO (owner/name).
import { readFile } from 'node:fs/promises';

const ASSET_NAME = 'campus-bites.apk';
const ADMIN_SITE = 'https://campus-bites-1-5kch.onrender.com';

const [apkPath] = process.argv.slice(2);
const { GITHUB_RELEASE_TOKEN: token, BUILD_ID, COMMIT, APP_VERSION, GITHUB_REPO: repo } = process.env;
if (!apkPath || !token || !BUILD_ID || !COMMIT || !repo) {
  throw new Error('Usage: node publish-github-release.mjs <apk>; needs GITHUB_RELEASE_TOKEN, BUILD_ID, COMMIT, GITHUB_REPO.');
}

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function github(method, url, body) {
  const response = await fetch(url.startsWith('http') ? url : `https://api.github.com/repos/${repo}${url}`, {
    method,
    headers: body === undefined ? headers : { ...headers, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 404 && method === 'GET') return null;
  if (!response.ok) throw new Error(`${method} ${url} → ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

const shortSha = COMMIT.slice(0, 7);
const tag = `android-${shortSha}`;
const buildPage = `https://expo.dev/accounts/meetpshah/projects/campus-bites/builds/${BUILD_ID}`;

// One release per commit; a re-run of the workflow reuses it and replaces the APK.
let release = await github('GET', `/releases/tags/${tag}`);
if (!release) {
  release = await github('POST', '/releases', {
    tag_name: tag,
    target_commitish: COMMIT,
    name: `Android ${APP_VERSION ?? ''} (${shortSha})`.replace('  ', ' '),
    body: [
      `Android preview build of commit ${COMMIT}.`,
      '',
      `- **Download:** \`${ASSET_NAME}\` below (or the always-latest link in the README)`,
      `- **EAS build:** ${buildPage}`,
      `- **Admin website:** ${ADMIN_SITE}`,
      '',
      'Install: open the APK on an Android phone and allow installing from this source.',
    ].join('\n'),
    make_latest: 'true',
  });
} else {
  await github('PATCH', `/releases/${release.id}`, { make_latest: 'true' });
}

for (const asset of release.assets ?? []) {
  if (asset.name === ASSET_NAME) await github('DELETE', `/releases/assets/${asset.id}`);
}

const apk = await readFile(apkPath);
const uploadUrl = release.upload_url.replace(/\{.*\}$/, `?name=${ASSET_NAME}`);
const upload = await fetch(uploadUrl, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/vnd.android.package-archive' },
  body: apk,
});
if (!upload.ok) throw new Error(`Upload failed → ${upload.status}: ${await upload.text()}`);

console.log(`Published ${release.html_url} (${(apk.byteLength / 1024 / 1024).toFixed(1)} MB)`);
