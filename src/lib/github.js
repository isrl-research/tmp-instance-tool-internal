export async function fetchStateFromGitHub(rawUrl) {
	const resp = await fetch(rawUrl);
	if (!resp.ok) throw new Error(`HTTP ${resp.status} — check the URL and that it's a raw GitHub link`);
	const text = await resp.text();
	const match = text.match(/^# IFID_STATE: (.+)$/m);
	if (!match) throw new Error('No IFID_STATE found. Is this an IFID-generated db.py?');
	return JSON.parse(atob(match[1].trim()));
}

export function parseGithubRawUrl(url) {
	const m = url.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(?:refs\/heads\/)?([^/]+)\/(.+)/);
	if (!m) return null;
	return { owner: m[1], repo: m[2], branch: m[3], path: m[4] };
}

function ghHeaders(token) {
	const t = (token || '').trim();
	const isFineGrained = t.startsWith('github_pat_');
	const scheme = isFineGrained ? 'Bearer' : 'token'; // Fine-grained MUST use Bearer
	
	console.log(`[GH Auth] Scheme: ${scheme}, Prefix: ${t.substring(0, 10)}...`);
	
	return {
		Authorization: `${scheme} ${t}`,
		Accept: 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28'
	};
}

export async function commitFile({ token, owner, repo, branch, path, content, message }) {
	const base = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
	const headers = ghHeaders(token);

	let sha;
	try {
		const getResp = await fetch(`${base}?ref=${branch}`, { headers });
		if (getResp.ok) {
			sha = (await getResp.json()).sha;
		} else if (getResp.status !== 404) {
			const err = await getResp.json().catch(() => ({}));
			throw new Error(`GET ${getResp.status}: ${err.message || 'Access denied'}`);
		}
	} catch (e) {
		if (e.message.includes('GET')) throw e;
		// Fall through for network errors or 404s
	}

	const body = { message, content: btoa(unescape(encodeURIComponent(content))), branch };
	if (sha) body.sha = sha;

	const putResp = await fetch(base, {
		method: 'PUT',
		headers: { ...headers, 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

	if (!putResp.ok) {
		const err = await putResp.json().catch(() => ({}));
		throw new Error(`PUT ${putResp.status}: ${err.message || 'Access denied'}`);
	}
	return putResp.json();
}

export async function createBranch({ token, owner, repo, baseBranch, newBranch }) {
	const headers = ghHeaders(token);
	const refResp = await fetch(
		`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${baseBranch}`,
		{ headers }
	);
	if (!refResp.ok) throw new Error(`Could not find base branch "${baseBranch}"`);
	const sha = (await refResp.json()).object.sha;

	const createResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
		method: 'POST',
		headers: { ...headers, 'Content-Type': 'application/json' },
		body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha })
	});
	if (!createResp.ok) {
		const err = await createResp.json().catch(() => ({}));
		throw new Error(err.message ?? `Could not create branch`);
	}
}

export async function createPR({ token, owner, repo, head, base, title, body }) {
	const headers = ghHeaders(token);
	const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
		method: 'POST',
		headers: { ...headers, 'Content-Type': 'application/json' },
		body: JSON.stringify({ title, body, head, base })
	});
	if (!resp.ok) {
		const err = await resp.json().catch(() => ({}));
		throw new Error(err.message ?? `Could not create PR`);
	}
	return (await resp.json()).html_url;
}
