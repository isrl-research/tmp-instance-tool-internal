<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	// When lockedSource is set the source filter is fixed and the load/download UI is hidden.
	// compact hides the CSV load section (used in split-view left pane).
	let { lockedSource = '', compact = false, onStartSession = null } = $props();

	const LS_KEY = 'ifid_progress';
	const DEFAULT_URL =
		'https://raw.githubusercontent.com/isrl-research/sandbox-research/refs/heads/nivedhya-onboarding/iSRL-26-06-D-Modelling/all_variants.csv';

	let csvUrl = $state(DEFAULT_URL);
	let rows = $state([]);
	let headers = $state([]);
	let progress = $state({});
	let loading = $state(false);
	let loadError = $state('');

	let filter = $state('');
	const activeFilter = $derived(lockedSource || filter);
	let statusFilter = $state('all');

	// inline comment edit: track which row's comment input is open
	let commentOpen = $state(null);
	let commentDraft = $state('');

	onMount(() => {
		if (!browser) return;
		try {
			const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null');
			if (saved) {
				rows = saved.rows ?? [];
				headers = saved.headers ?? [];
				progress = saved.progress ?? {};
				if (saved.csvUrl) csvUrl = saved.csvUrl;
			}
		} catch { /* */ }
	});

	function persist() {
		if (!browser) return;
		localStorage.setItem(LS_KEY, JSON.stringify({ csvUrl, rows, headers, progress }));
	}

	function parseCsv(text) {
		const lines = text.trim().split(/\r?\n/);
		if (!lines.length) return { headers: [], rows: [] };
		const hdrs = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
		const parsed = lines.slice(1).map((line, idx) => {
			const vals = [];
			let cur = '';
			let inQ = false;
			for (let i = 0; i < line.length; i++) {
				const ch = line[i];
				if (ch === '"') { inQ = !inQ; continue; }
				if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; continue; }
				cur += ch;
			}
			vals.push(cur.trim());
			const obj = { _id: idx };
			hdrs.forEach((h, i) => (obj[h] = vals[i] ?? ''));
			return obj;
		});
		return { headers: hdrs, rows: parsed };
	}

	// Purely derived — no mutation needed
	const duplicateIds = $derived.by(() => {
		const seen = new Map(); // variant → first _id
		const dups = new Set();
		rows.forEach((r) => {
			if (!r.variant) return;
			if (!seen.has(r.variant)) seen.set(r.variant, r._id);
			else dups.add(r._id);
		});
		return dups;
	});

	function autoMarkDuplicates(parsedRows, existingProgress) {
		const seen = new Map();
		const prog = { ...existingProgress };
		parsedRows.forEach((r) => {
			if (!r.variant) return;
			if (!seen.has(r.variant)) {
				seen.set(r.variant, r._id);
			} else if (!prog[r._id]) {
				prog[r._id] = { status: 'done', comment: `duplicate of row ${seen.get(r.variant)}` };
			}
		});
		return prog;
	}

	async function loadCsv() {
		if (!csvUrl.trim()) return;
		loading = true;
		loadError = '';
		try {
			const resp = await fetch(csvUrl.trim());
			if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
			const text = await resp.text();
			const parsed = parseCsv(text);
			headers = parsed.headers;
			rows = parsed.rows;
			progress = autoMarkDuplicates(parsed.rows, progress);
			persist();
		} catch (e) {
			loadError = e.message;
		} finally {
			loading = false;
		}
	}

	function sourceMatches(sourceCell, query) {
		if (!query.trim()) return true;
		const q = query.trim().toLowerCase();
		return sourceCell
			.split('|')
			.map((s) => s.trim().toLowerCase())
			.some((s) => s.includes(q));
	}

	const visibleRows = $derived(rows.filter((r) => !duplicateIds.has(r._id)));

	const filtered = $derived(
		visibleRows.filter((r) => {
			const srcOk = sourceMatches(r.source ?? '', activeFilter);
			const status = progress[r._id]?.status ?? 'todo';
			const statusOk = statusFilter === 'all' || status === statusFilter;
			return srcOk && statusOk;
		})
	);

	const stats = $derived({
		total: visibleRows.length,
		done: visibleRows.filter((r) => (progress[r._id]?.status ?? 'todo') === 'done').length,
		flagged: visibleRows.filter((r) => (progress[r._id]?.status ?? 'todo') === 'flagged').length,
		todo: visibleRows.filter((r) => (progress[r._id]?.status ?? 'todo') === 'todo').length
	});

	function setStatus(id, status) {
		progress = { ...progress, [id]: { status, comment: progress[id]?.comment ?? '' } };
		persist();
	}

	function openComment(id) {
		commentOpen = id;
		commentDraft = progress[id]?.comment ?? '';
	}

	function saveComment(id) {
		progress = {
			...progress,
			[id]: { status: progress[id]?.status ?? 'flagged', comment: commentDraft }
		};
		commentOpen = null;
		persist();
	}

	function downloadProgress() {
		const extraCols = ['progress', 'comment'];
		const allHeaders = [...headers, ...extraCols];
		const csvLines = [allHeaders.join(',')];
		rows.forEach((r) => {
			const p = progress[r._id] ?? { status: 'todo', comment: '' };
			const baseVals = headers.map((h) => {
				const v = r[h] ?? '';
				return v.includes(',') ? `"${v}"` : v;
			});
			const comment = (p.comment ?? '').replace(/"/g, '""');
			csvLines.push([...baseVals, p.status, comment ? `"${comment}"` : ''].join(','));
		});
		const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'progress.csv';
		a.click();
		URL.revokeObjectURL(url);
	}

	const pct = $derived(stats.total ? Math.round((stats.done / stats.total) * 100) : 0);
</script>

<div class="space-y-5">
	<!-- Load CSV (hidden in compact/split mode) -->
	{#if !compact}
		<div class="bg-white border border-gray-200 rounded-lg p-4">
			<div class="flex gap-2 items-start">
				<div class="flex-1">
					<label class="block text-xs text-gray-500 mb-1">CSV URL (raw GitHub)</label>
					<input
						bind:value={csvUrl}
						onkeydown={(e) => e.key === 'Enter' && loadCsv()}
						class="border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-teal-500"
					/>
					{#if loadError}
						<p class="text-red-500 text-xs mt-1">{loadError}</p>
					{/if}
				</div>
				<button
					onclick={loadCsv}
					disabled={loading}
					class="mt-5 px-4 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded text-sm font-medium whitespace-nowrap"
				>
					{loading ? 'Loading…' : rows.length ? 'Reload' : 'Load CSV'}
				</button>
			</div>
		</div>
	{/if}

	{#if rows.length}
		<!-- Stats + download -->
		<div class="flex items-center gap-4 flex-wrap">
			<div class="flex-1 min-w-52">
				<div class="flex justify-between text-xs text-gray-500 mb-1">
					<span>{stats.done} done · {stats.flagged} flagged · {stats.todo} todo</span>
					<span class="font-medium text-gray-700">{pct}%</span>
				</div>
				<div class="h-2 bg-gray-100 rounded-full overflow-hidden">
					<div class="h-full bg-teal-500 rounded-full transition-all" style="width:{pct}%"></div>
				</div>
			</div>
			{#if !compact}
				<button
					onclick={downloadProgress}
					class="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm font-medium"
				>
					↓ Download progress.csv
				</button>
			{/if}
		</div>

		<!-- Filters -->
		<div class="flex gap-3 items-center flex-wrap">
			{#if lockedSource}
				<div class="flex items-center gap-2 flex-1">
					<span class="text-xs text-gray-500">Filtered to:</span>
					<span class="px-2 py-0.5 bg-teal-100 text-teal-800 rounded text-xs font-medium">{lockedSource}</span>
				</div>
			{:else}
				<div class="relative flex-1 min-w-48">
					<input
						bind:value={filter}
						placeholder="Filter by source (e.g. milk)"
						class="border border-gray-300 rounded px-2 py-1.5 text-sm w-full pr-7 focus:outline-none focus:ring-1 focus:ring-teal-500"
					/>
					{#if filter}
						<button
							onclick={() => (filter = '')}
							class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
						>✕</button>
					{/if}
				</div>
			{/if}
			{#if onStartSession}
				<button
					onclick={() => onStartSession(lockedSource || filter.trim())}
					class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium whitespace-nowrap"
				>▶ Start Session</button>
			{/if}
			<div class="flex gap-1">
				{#each ['all', 'todo', 'done', 'flagged'] as s}
					<button
						onclick={() => (statusFilter = s)}
						class="px-2.5 py-1 rounded text-xs font-medium border transition-colors {statusFilter === s
							? s === 'done' ? 'bg-teal-600 text-white border-teal-600'
							: s === 'flagged' ? 'bg-amber-500 text-white border-amber-500'
							: s === 'todo' ? 'bg-gray-500 text-white border-gray-500'
							: 'bg-gray-800 text-white border-gray-800'
							: 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}"
					>{s}</button>
				{/each}
			</div>
			{#if filter || statusFilter !== 'all'}
				<span class="text-xs text-gray-400">{filtered.length} of {rows.length}</span>
			{/if}
		</div>

		<!-- Table -->
		<div class="bg-white border border-gray-200 rounded-lg">
			<div class="overflow-x-auto">
			<table class="w-full min-w-[640px] text-sm">
				<thead class="bg-gray-50 border-b border-gray-200">
					<tr>
						<th class="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Variant</th>
						<th class="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
						<th class="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">f_revised</th>
						<th class="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
						<th class="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Comment</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each filtered as r (r._id)}
						{@const status = progress[r._id]?.status ?? 'todo'}
						{@const comment = progress[r._id]?.comment ?? ''}
						<tr class="hover:bg-gray-50 {status === 'done' ? 'opacity-60' : ''}">
							<td class="px-4 py-2 font-mono font-medium text-gray-800">{r.variant}</td>
							<td class="px-4 py-2">
								<div class="flex flex-wrap gap-1">
									{#each (r.source ?? '').split('|').map(s => s.trim()) as src}
										<span
											class="px-1.5 py-0.5 rounded text-xs {filter && src.toLowerCase().includes(filter.trim().toLowerCase()) ? 'bg-teal-100 text-teal-800 font-medium' : 'bg-gray-100 text-gray-600'}"
										>{src}</span>
									{/each}
								</div>
							</td>
							<td class="px-4 py-2 text-gray-600 text-xs">{r.f_revised ?? ''}</td>
							<td class="px-4 py-2">
								<div class="flex gap-1">
									<button
										onclick={() => setStatus(r._id, 'todo')}
										class="px-2 py-0.5 rounded text-xs border font-medium transition-colors {status === 'todo' ? 'bg-gray-500 text-white border-gray-500' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'}"
									>Todo</button>
									<button
										onclick={() => setStatus(r._id, 'done')}
										class="px-2 py-0.5 rounded text-xs border font-medium transition-colors {status === 'done' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-400 border-gray-200 hover:border-teal-400'}"
									>Done</button>
									<button
										onclick={() => { setStatus(r._id, 'flagged'); openComment(r._id); }}
										class="px-2 py-0.5 rounded text-xs border font-medium transition-colors {status === 'flagged' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-400 border-gray-200 hover:border-amber-400'}"
									>Flag</button>
								</div>
							</td>
							<td class="px-4 py-2">
								{#if commentOpen === r._id}
									<div class="flex gap-1.5">
										<input
											bind:value={commentDraft}
											placeholder="Add comment…"
											onkeydown={(e) => e.key === 'Enter' && saveComment(r._id)}
											class="border border-gray-300 rounded px-2 py-0.5 text-xs flex-1 focus:outline-none focus:ring-1 focus:ring-teal-500"
											autofocus
										/>
										<button onclick={() => saveComment(r._id)} class="text-teal-600 hover:text-teal-800 text-xs font-medium">Save</button>
										<button onclick={() => (commentOpen = null)} class="text-gray-400 hover:text-gray-600 text-xs">✕</button>
									</div>
								{:else}
									<button
										onclick={() => openComment(r._id)}
										class="text-xs {comment ? 'text-amber-700 font-medium' : 'text-gray-300 hover:text-gray-500'} text-left max-w-48 truncate"
									>
										{comment || (status === 'flagged' ? 'add comment…' : '+')}
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			</div>
			{#if !filtered.length}
				<p class="text-sm text-gray-400 text-center py-8">No rows match the current filter.</p>
			{/if}
		</div>
	{:else if !loading}
		<p class="text-sm text-gray-400 text-center py-12">Load a CSV to start tracking progress.</p>
	{/if}
</div>
