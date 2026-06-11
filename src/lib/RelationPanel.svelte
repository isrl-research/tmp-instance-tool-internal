<script>
	import { store } from '$lib/store.svelte.js';
	import { PROCESSING_METHODS } from '$lib/enums.js';
	import MethodSelect from '$lib/MethodSelect.svelte';

	// FormOf state
	let fof = $state({ origin: '', form: '', processing_methods: [] });
	let fofError = $state('');
	let fofEditId = $state(null);
	let fofEditDraft = $state({});
	let fofDeleteId = $state(null);

	// VarietyOf state
	let vof = $state({ base: '', variety: '' });
	let vofError = $state('');
	let vofEditId = $state(null);
	let vofEditDraft = $state({});
	let vofDeleteId = $state(null);

	const formOfs = $derived(store.relations.filter((r) => r.type === 'FormOf'));
	const varietyOfs = $derived(store.relations.filter((r) => r.type === 'VarietyOf'));

	function sourceName(id) { return store.sources.find((s) => s.id === id)?.name ?? id; }
	function formId(id) { return store.forms.find((f) => f.id === id)?.id ?? id; }

	// FormOf
	function addFormOf() {
		if (!fof.origin) { fofError = 'Origin source is required'; return; }
		if (!fof.form) { fofError = 'Form is required'; return; }
		if (!fof.processing_methods.length) { fofError = 'At least one processing method is required'; return; }
		store.addRelation({ type: 'FormOf', origin: fof.origin, form: fof.form, processing_methods: fof.processing_methods });
		fof = { origin: '', form: '', processing_methods: [] };
		fofError = '';
	}

	function startEditFof(r) {
		fofEditId = r.id;
		fofEditDraft = { ...r, processing_methods: [...r.processing_methods] };
		fofDeleteId = null;
	}
	function saveEditFof() {
		store.updateRelation(fofEditId, fofEditDraft);
		fofEditId = null;
	}
	function cancelEditFof() { fofEditId = null; }
	function confirmDeleteFof(id) { fofDeleteId = id; fofEditId = null; }
	function doDeleteFof(id) { store.deleteRelation(id); fofDeleteId = null; }

	// VarietyOf
	function addVarietyOf() {
		if (!vof.base) { vofError = 'Base source is required'; return; }
		if (!vof.variety) { vofError = 'Variety source is required'; return; }
		if (vof.base === vof.variety) { vofError = 'Base and variety cannot be the same'; return; }
		store.addRelation({ type: 'VarietyOf', base: vof.base, variety: vof.variety });
		vof = { base: '', variety: '' };
		vofError = '';
	}

	function startEditVof(r) {
		vofEditId = r.id;
		vofEditDraft = { ...r };
		vofDeleteId = null;
	}
	function saveEditVof() {
		if (vofEditDraft.base === vofEditDraft.variety) return;
		store.updateRelation(vofEditId, vofEditDraft);
		vofEditId = null;
	}
	function cancelEditVof() { vofEditId = null; }
	function confirmDeleteVof(id) { vofDeleteId = id; vofEditId = null; }
	function doDeleteVof(id) { store.deleteRelation(id); vofDeleteId = null; }
</script>

<div class="space-y-8">

	<!-- FormOf -->
	<div class="space-y-4">
		<h3 class="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">FormOf — source → form via process</h3>

		<div class="bg-white border border-gray-200 rounded-lg p-4">
			<div class="grid grid-cols-2 gap-3 mb-3">
				<div>
					<label class="block text-xs text-gray-500 mb-1">Origin (Source)</label>
					<select
						bind:value={fof.origin}
						class="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-full focus:outline-none focus:ring-1 focus:ring-teal-500"
					>
						<option value="" disabled>Select source…</option>
						{#each store.sources as s}
							<option value={s.id}>{s.name}</option>
						{/each}
					</select>
					{#if !store.sources.length}
						<p class="text-xs text-amber-600 mt-1">Add sources first.</p>
					{/if}
				</div>
				<div>
					<label class="block text-xs text-gray-500 mb-1">Form</label>
					<select
						bind:value={fof.form}
						class="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-full focus:outline-none focus:ring-1 focus:ring-teal-500"
					>
						<option value="" disabled>Select form…</option>
						{#each store.forms as f}
							<option value={f.id}>{f.id}</option>
						{/each}
					</select>
					{#if !store.forms.length}
						<p class="text-xs text-amber-600 mt-1">Add forms first.</p>
					{/if}
				</div>
			</div>

			<div class="mb-3">
				<label class="block text-xs text-gray-500 mb-1">Processing Methods</label>
				<MethodSelect
					options={PROCESSING_METHODS}
					customOptions={store.customMethods}
					selected={fof.processing_methods}
					onchange={(v) => (fof.processing_methods = v)}
					onAddCustom={(v) => store.addCustomMethod(v)}
				/>
			</div>

			{#if fofError}
				<p class="text-red-500 text-xs mb-2">{fofError}</p>
			{/if}
			<button onclick={addFormOf} class="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm font-medium">
				Add FormOf
			</button>
		</div>

		{#if formOfs.length}
			<div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
				<table class="w-full text-sm">
					<thead class="bg-gray-50 border-b border-gray-200">
						<tr>
							<th class="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Origin</th>
							<th class="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Form</th>
							<th class="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Methods</th>
							<th class="px-4 py-2"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{#each formOfs as r (r.id)}
							{#if fofEditId === r.id}
								<tr class="bg-teal-50">
									<td class="px-3 py-2">
										<select
											bind:value={fofEditDraft.origin}
											class="border border-gray-300 rounded px-2 py-1 text-sm bg-white w-full"
										>
											{#each store.sources as s}
												<option value={s.id}>{s.name}</option>
											{/each}
										</select>
									</td>
									<td class="px-3 py-2">
										<select
											bind:value={fofEditDraft.form}
											class="border border-gray-300 rounded px-2 py-1 text-sm bg-white w-full"
										>
											{#each store.forms as f}
												<option value={f.id}>{f.id}</option>
											{/each}
										</select>
									</td>
									<td class="px-3 py-2 min-w-64">
										<MethodSelect
											options={PROCESSING_METHODS}
											customOptions={store.customMethods}
											selected={fofEditDraft.processing_methods}
											onchange={(v) => (fofEditDraft.processing_methods = v)}
											onAddCustom={(v) => store.addCustomMethod(v)}
										/>
									</td>
									<td class="px-3 py-2 whitespace-nowrap">
										<button onclick={saveEditFof} class="text-teal-700 hover:text-teal-900 font-medium text-xs mr-2">Save</button>
										<button onclick={cancelEditFof} class="text-gray-500 hover:text-gray-700 text-xs">Cancel</button>
									</td>
								</tr>
							{:else if fofDeleteId === r.id}
								<tr class="bg-red-50">
									<td colspan="3" class="px-4 py-2 text-sm text-red-700">
										Delete this relation (<strong>{sourceName(r.origin)}</strong> → <strong>{r.form}</strong>)?
									</td>
									<td class="px-3 py-2 whitespace-nowrap">
										<button onclick={() => doDeleteFof(r.id)} class="text-red-600 hover:text-red-800 font-medium text-xs mr-2">Delete</button>
										<button onclick={() => (fofDeleteId = null)} class="text-gray-500 hover:text-gray-700 text-xs">Cancel</button>
									</td>
								</tr>
							{:else}
								<tr class="hover:bg-gray-50">
									<td class="px-4 py-2 font-medium">{sourceName(r.origin)}</td>
									<td class="px-4 py-2 font-mono text-gray-700">{r.form}</td>
									<td class="px-4 py-2">
										<div class="flex flex-wrap gap-1">
											{#each r.processing_methods as m}
												<span class="inline-block px-1.5 py-0.5 rounded text-xs {store.customMethods.includes(m) ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-700'}">
													{m}{store.customMethods.includes(m) ? ' ✦' : ''}
												</span>
											{/each}
										</div>
									</td>
									<td class="px-4 py-2 whitespace-nowrap text-right">
										<button onclick={() => startEditFof(r)} class="text-gray-400 hover:text-teal-700 text-xs mr-3">Edit</button>
										<button onclick={() => confirmDeleteFof(r.id)} class="text-gray-400 hover:text-red-600 text-xs">Delete</button>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="text-sm text-gray-400 text-center py-4">No FormOf relations yet.</p>
		{/if}
	</div>

	<!-- VarietyOf -->
	<div class="space-y-4">
		<h3 class="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">VarietyOf — taxonomic sub-type</h3>

		<div class="bg-white border border-gray-200 rounded-lg p-4">
			<div class="grid grid-cols-2 gap-3 mb-3">
				<div>
					<label class="block text-xs text-gray-500 mb-1">Base Source</label>
					<select
						bind:value={vof.base}
						class="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-full focus:outline-none focus:ring-1 focus:ring-teal-500"
					>
						<option value="" disabled>Select base…</option>
						{#each store.sources as s}
							<option value={s.id}>{s.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="block text-xs text-gray-500 mb-1">Variety (sub-type)</label>
					<select
						bind:value={vof.variety}
						class="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-full focus:outline-none focus:ring-1 focus:ring-teal-500"
					>
						<option value="" disabled>Select variety…</option>
						{#each store.sources as s}
							<option value={s.id}>{s.name}</option>
						{/each}
					</select>
				</div>
			</div>

			{#if vofError}
				<p class="text-red-500 text-xs mb-2">{vofError}</p>
			{/if}
			<button onclick={addVarietyOf} class="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm font-medium">
				Add VarietyOf
			</button>
		</div>

		{#if varietyOfs.length}
			<div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
				<table class="w-full text-sm">
					<thead class="bg-gray-50 border-b border-gray-200">
						<tr>
							<th class="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Variety</th>
							<th class="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Base</th>
							<th class="px-4 py-2"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{#each varietyOfs as r (r.id)}
							{#if vofEditId === r.id}
								<tr class="bg-teal-50">
									<td class="px-3 py-2">
										<select bind:value={vofEditDraft.variety} class="border border-gray-300 rounded px-2 py-1 text-sm bg-white w-full">
											{#each store.sources as s}
												<option value={s.id}>{s.name}</option>
											{/each}
										</select>
									</td>
									<td class="px-3 py-2">
										<select bind:value={vofEditDraft.base} class="border border-gray-300 rounded px-2 py-1 text-sm bg-white w-full">
											{#each store.sources as s}
												<option value={s.id}>{s.name}</option>
											{/each}
										</select>
									</td>
									<td class="px-3 py-2 whitespace-nowrap">
										<button onclick={saveEditVof} class="text-teal-700 hover:text-teal-900 font-medium text-xs mr-2">Save</button>
										<button onclick={cancelEditVof} class="text-gray-500 hover:text-gray-700 text-xs">Cancel</button>
									</td>
								</tr>
							{:else if vofDeleteId === r.id}
								<tr class="bg-red-50">
									<td colspan="2" class="px-4 py-2 text-sm text-red-700">
										Delete <strong>{sourceName(r.variety)}</strong> ⊂ <strong>{sourceName(r.base)}</strong>?
									</td>
									<td class="px-3 py-2 whitespace-nowrap">
										<button onclick={() => doDeleteVof(r.id)} class="text-red-600 hover:text-red-800 font-medium text-xs mr-2">Delete</button>
										<button onclick={() => (vofDeleteId = null)} class="text-gray-500 hover:text-gray-700 text-xs">Cancel</button>
									</td>
								</tr>
							{:else}
								<tr class="hover:bg-gray-50">
									<td class="px-4 py-2 font-medium">{sourceName(r.variety)}</td>
									<td class="px-4 py-2 text-gray-500">⊂ {sourceName(r.base)}</td>
									<td class="px-4 py-2 whitespace-nowrap text-right">
										<button onclick={() => startEditVof(r)} class="text-gray-400 hover:text-teal-700 text-xs mr-3">Edit</button>
										<button onclick={() => confirmDeleteVof(r.id)} class="text-gray-400 hover:text-red-600 text-xs">Delete</button>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="text-sm text-gray-400 text-center py-4">No VarietyOf relations yet.</p>
		{/if}
	</div>
</div>
