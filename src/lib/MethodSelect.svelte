<script>
	let { options, customOptions = [], selected, onchange, onAddCustom } = $props();

	let showAdd = $state(false);
	let newVal = $state('');

	function toggle(m) {
		const next = selected.includes(m) ? selected.filter((x) => x !== m) : [...selected, m];
		onchange(next);
	}

	function addNew() {
		const v = newVal.trim();
		if (!v) return;
		onAddCustom?.(v);
		onchange([...selected, v]);
		newVal = '';
		showAdd = false;
	}

	let query = $state('');

	const allOptions = $derived([...options, ...customOptions]);
	const filtered = $derived(
		query.trim()
			? allOptions.filter((m) => m.toLowerCase().includes(query.trim().toLowerCase()))
			: allOptions
	);
</script>

<div class="border border-gray-300 rounded bg-white">
	<div class="px-2 pt-2 pb-1 border-b border-gray-100">
		<input
			bind:value={query}
			placeholder="Search methods…"
			class="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 bg-gray-50"
		/>
	</div>
	<div class="max-h-40 overflow-y-auto p-2 grid grid-cols-2 gap-x-6 gap-y-0.5">
		{#each filtered as m}
			<label class="flex items-center gap-1.5 text-sm cursor-pointer hover:text-teal-700">
				<input
					type="checkbox"
					checked={selected.includes(m)}
					onchange={() => toggle(m)}
					class="accent-teal-600"
				/>
				<span class:text-teal-700={customOptions.includes(m)} class:font-medium={customOptions.includes(m)}>
					{m}{customOptions.includes(m) ? ' ✦' : ''}
				</span>
			</label>
		{/each}
	</div>

	<div class="border-t border-gray-100 px-2 py-1.5">
		{#if !showAdd}
			<button
				onclick={() => (showAdd = true)}
				class="text-xs text-teal-600 hover:text-teal-800 font-medium"
			>+ Add custom method</button>
		{:else}
			<div class="flex gap-1.5">
				<input
					bind:value={newVal}
					placeholder="e.g. centrifugation"
					onkeydown={(e) => e.key === 'Enter' && addNew()}
					class="border border-gray-300 rounded px-2 py-1 text-sm flex-1 focus:outline-none focus:ring-1 focus:ring-teal-500"
				/>
				<button onclick={addNew} class="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs">Add</button>
				<button onclick={() => { showAdd = false; newVal = ''; }} class="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs">✕</button>
			</div>
		{/if}
	</div>
</div>
