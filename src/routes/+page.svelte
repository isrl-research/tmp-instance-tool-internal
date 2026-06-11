<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { store } from '$lib/store.svelte.js';
	import { generatePython } from '$lib/codegen.js';
	import { fetchStateFromGitHub, commitFile } from '$lib/github.js';
	import SourcePanel from '$lib/SourcePanel.svelte';
	import FormPanel from '$lib/FormPanel.svelte';
	import RelationPanel from '$lib/RelationPanel.svelte';
	import ProgressPanel from '$lib/ProgressPanel.svelte';

	const GH_CFG_KEY = 'ifid_gh_config';

	// Hardcoded target repo
	const PUSH_OWNER = 'isrl-research';
	const PUSH_REPO = 'tmp-instance';

	let tab = $state('sources');

	// Load from GitHub
	let showLoad = $state(false);
	let loadUrl = $state('');
	let loadError = $state('');
	let loadBusy = $state(false);

	// Push config
	let showCommit = $state(false);
	let ghToken = $state('');
	let commitBusy = $state(false);
	let commitError = $state('');
	let pushUrl = $state('');

	// Session / split-view
	let sessionMode = $state(false);
	let sessionSource = $state('');

	const entryTabs = [
		{ id: 'sources', label: 'Sources', count: () => store.sources.length },
		{ id: 'forms', label: 'Forms', count: () => store.forms.length },
		{ id: 'relations', label: 'Relations', count: () => store.relations.length }
	];

	onMount(async () => {
		await store.init();
		if (!browser) return;
		try {
			const cfg = JSON.parse(localStorage.getItem(GH_CFG_KEY) ?? 'null');
			if (cfg) ghToken = cfg.token ?? '';
		} catch { /* */ }
	});

	function saveGhConfig() {
		if (!browser) return;
		localStorage.setItem(GH_CFG_KEY, JSON.stringify({ token: ghToken }));
	}

	function getISTDate() {
		const now = new Date();
		const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
		return ist.toISOString().slice(0, 10);
	}

	function sessionSlug() {
		return sessionSource
			? sessionSource.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
			: 'session';
	}

	function getProgressCsv() {
		try {
			const saved = JSON.parse(localStorage.getItem('ifid_progress') ?? 'null');
			if (!saved?.rows?.length) return null;
			const { rows, headers, progress } = saved;
			const allHeaders = [...(headers ?? []), 'progress', 'comment'];
			const lines = [allHeaders.join(',')];
			rows.forEach((r) => {
				const p = progress?.[r._id] ?? { status: 'todo', comment: '' };
				const base = (headers ?? []).map((h) => {
					const v = r[h] ?? '';
					return v.includes(',') ? `"${v}"` : v;
				});
				const c = (p.comment ?? '').replace(/"/g, '""');
				lines.push([...base, p.status, c ? `"${c}"` : ''].join(','));
			});
			return lines.join('\n');
		} catch { return null; }
	}

	function download() {
		const py = generatePython(store.snapshot());
		const blob = new Blob([py], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'db.py';
		a.click();
		URL.revokeObjectURL(url);
	}

	async function loadFromGithub() {
		if (!loadUrl.trim()) { loadError = 'Enter a URL'; return; }
		loadBusy = true;
		loadError = '';
		try {
			const state = await fetchStateFromGitHub(loadUrl.trim());
			store.loadState(state);
			showLoad = false;
			loadUrl = '';
		} catch (e) {
			loadError = e.message;
		} finally {
			loadBusy = false;
		}
	}

	function buildEnumRequests(current, slug, date) {
		const methods = current.customMethods ?? [];
		const states = current.customMatterStates ?? [];
		const types = current.customSourceTypes ?? [];
		if (!methods.length && !states.length && !types.length) return null;
		const lines = [`# Enum Requests — ${slug} — ${date}`, ''];
		if (methods.length) {
			lines.push('## Processing Methods');
			methods.forEach((m) => lines.push(`- \`${m}\``));
			lines.push('');
		}
		if (states.length) {
			lines.push('## Matter States');
			states.forEach((s) => lines.push(`- \`${s}\``));
			lines.push('');
		}
		if (types.length) {
			lines.push('## Source Types');
			types.forEach((t) => lines.push(`- \`${t}\``));
			lines.push('');
		}
		return lines.join('\n');
	}

	async function pushSession() {
		if (!ghToken) { commitError = 'GitHub token is required'; return; }
		saveGhConfig();
		commitBusy = true;
		commitError = '';
		pushUrl = '';

		const date = getISTDate();
		const slug = sessionSlug();
		const folder = `${date}/${slug}`;
		const current = store.snapshot();
		const base = { token: ghToken, owner: PUSH_OWNER, repo: PUSH_REPO, branch: 'main', message: `${date}: ${slug} session` };

		try {
			await commitFile({ ...base, path: `${folder}.json`, content: JSON.stringify(current, null, 2) });
			await commitFile({ ...base, path: `${folder}.py`, content: generatePython(current) });
			const csv = getProgressCsv();
			if (csv) await commitFile({ ...base, path: `${folder}-progress.csv`, content: csv });
			const enumMd = buildEnumRequests(current, slug, date);
			if (enumMd) await commitFile({ ...base, path: `${folder}-enum-requests.md`, content: enumMd });
			pushUrl = `https://github.com/${PUSH_OWNER}/${PUSH_REPO}/tree/main/${date}`;
		} catch (e) {
			commitError = e.message;
		} finally {
			commitBusy = false;
		}
	}

	function startSession(source) { sessionSource = source; sessionMode = true; }
	function exitSession() { sessionMode = false; sessionSource = ''; }

	const hasCustom = $derived(
		store.customMethods.length || store.customMatterStates.length || store.customSourceTypes.length
	);
</script>

<div class="h-screen flex flex-col bg-gray-50">
	<!-- Header -->
	<header class="bg-white border-b border-gray-200 z-10 flex-shrink-0">
		<div class="px-6 py-3 flex items-center justify-between gap-4">
			<div class="flex items-center gap-3">
				{#if sessionMode}
					<button onclick={exitSession} class="text-xs text-gray-400 hover:text-gray-700 font-medium">← Exit Session</button>
					<span class="text-gray-200">|</span>
					<span class="text-sm text-gray-600">Session: <span class="font-semibold text-indigo-700">{sessionSource}</span></span>
				{:else}
					<div>
						<h1 class="text-base font-semibold text-gray-900">IFID Entry Tool</h1>
						<p class="text-xs text-gray-400">Indian Food Informatics Data</p>
					</div>
				{/if}
			</div>
			<div class="flex items-center gap-2">
				{#if !sessionMode}
					<button
						onclick={() => { showLoad = !showLoad; showCommit = false; loadError = ''; }}
						class="px-3 py-1.5 text-sm border border-gray-300 hover:border-gray-400 rounded font-medium text-gray-600 hover:text-gray-900"
					>↓ Load</button>
				{/if}
				<button onclick={download} class="px-3 py-1.5 text-sm border border-gray-300 hover:border-gray-400 rounded font-medium text-gray-600 hover:text-gray-900">
					↓ db.py
				</button>
				<button
					onclick={() => { showCommit = !showCommit; showLoad = false; commitError = ''; pushUrl = ''; }}
					class="px-3 py-1.5 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded font-medium"
				>↑ Push Session</button>
			</div>
		</div>

		<!-- Load panel -->
		{#if showLoad}
			<div class="border-t border-gray-100 bg-gray-50 px-6 py-3 flex gap-2 items-start">
				<div class="flex-1">
					<input
						bind:value={loadUrl}
						placeholder="https://raw.githubusercontent.com/nivedya02/sandbox-research/main/iSRL-26-06-D-Modelling/db.py"
						onkeydown={(e) => e.key === 'Enter' && loadFromGithub()}
						class="border border-gray-300 rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-teal-500"
					/>
					{#if loadError}<p class="text-red-500 text-xs mt-1">{loadError}</p>{/if}
				</div>
				<button onclick={loadFromGithub} disabled={loadBusy}
					class="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded text-sm font-medium whitespace-nowrap">
					{loadBusy ? 'Loading…' : 'Load'}
				</button>
				<button onclick={() => { showLoad = false; loadError = ''; }} class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm">✕</button>
			</div>
		{/if}

		<!-- Push panel -->
		{#if showCommit}
			<div class="border-t border-gray-100 bg-gray-50 px-6 py-4 space-y-3">
				<div class="flex gap-3 items-end">
					<div class="flex-1">
						<label class="block text-xs text-gray-500 mb-1">GitHub Token <span class="text-gray-400">(stored locally only)</span></label>
						<input type="password" bind:value={ghToken} placeholder="ghp_…"
							class="border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-teal-500" />
					</div>
					<div class="text-xs text-gray-400 pb-2">
						→ <code class="bg-gray-100 px-1 rounded">{PUSH_OWNER}/{PUSH_REPO}/{getISTDate()}/{sessionSlug()}.json</code>
					</div>
				</div>
				{#if commitError}<p class="text-red-500 text-xs">{commitError}</p>{/if}
				{#if pushUrl}
					<p class="text-teal-700 text-sm font-medium">
						✓ Pushed: <a href={pushUrl} target="_blank" class="underline hover:text-teal-900 break-all">{pushUrl}</a>
					</p>
				{/if}
				<div class="flex gap-2">
					<button onclick={pushSession} disabled={commitBusy}
						class="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded text-sm font-medium">
						{commitBusy ? 'Pushing…' : 'Push Session'}
					</button>
					<button onclick={() => { showCommit = false; }} class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm">Close</button>
				</div>
			</div>
		{/if}
	</header>

	<!-- Main content -->
	{#if sessionMode}
		<div class="flex flex-1 overflow-hidden">
			<!-- Left: progress -->
			<div class="w-[42%] border-r border-gray-200 overflow-y-auto bg-white px-5 py-4">
				<ProgressPanel lockedSource={sessionSource} compact={true} />
			</div>
			<!-- Right: entry tabs -->
			<div class="flex-1 overflow-y-auto px-6 py-4">
				{#if hasCustom}
					<div class="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2 mb-4 text-xs text-teal-800">
						<span class="font-medium">✦ Custom enum values in use</span> — will be flagged in db.py.
					</div>
				{/if}
				<div class="flex border-b border-gray-200 mb-5">
					{#each entryTabs as t}
						<button onclick={() => (tab = t.id)}
							class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors {tab === t.id ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}">
							{t.label}
							<span class="ml-1.5 px-1.5 py-0.5 rounded-full text-xs {tab === t.id ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'}">
								{t.count()}
							</span>
						</button>
					{/each}
				</div>
				{#if tab === 'sources'}<SourcePanel />
				{:else if tab === 'forms'}<FormPanel />
				{:else}<RelationPanel />{/if}
				<div class="h-10"></div>
			</div>
		</div>
	{:else}
		<div class="flex-1 overflow-y-auto">
			<div class="max-w-5xl mx-auto px-6 pt-4">
				{#if hasCustom}
					<div class="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2.5 flex items-start gap-2 text-sm text-teal-800 mb-4">
						<span class="font-semibold mt-0.5">✦</span>
						<div>
							<span class="font-medium">Custom enum values in use</span> — flagged in db.py.
							{#if store.customMethods.length}<span class="ml-1">Methods: {store.customMethods.join(', ')}.</span>{/if}
							{#if store.customMatterStates.length}<span class="ml-1">States: {store.customMatterStates.join(', ')}.</span>{/if}
							{#if store.customSourceTypes.length}<span class="ml-1">Types: {store.customSourceTypes.join(', ')}.</span>{/if}
						</div>
					</div>
				{/if}
				<div class="flex border-b border-gray-200 mb-6">
					{#each [...entryTabs, { id: 'progress', label: 'Progress', count: () => null }] as t}
						<button onclick={() => (tab = t.id)}
							class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors {tab === t.id ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}">
							{t.label}
							{#if t.count() !== null}
								<span class="ml-1.5 px-1.5 py-0.5 rounded-full text-xs {tab === t.id ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'}">{t.count()}</span>
							{/if}
						</button>
					{/each}
				</div>
				{#if tab === 'sources'}<SourcePanel />
				{:else if tab === 'forms'}<FormPanel />
				{:else if tab === 'relations'}<RelationPanel />
				{:else}<ProgressPanel onStartSession={startSession} lockedSource="milk" />{/if}
				<div class="h-12"></div>
			</div>
		</div>
	{/if}
</div>
