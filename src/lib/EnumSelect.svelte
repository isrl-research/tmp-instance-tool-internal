<script>
	let { options, customOptions = [], value, onchange, onAddCustom, placeholder = 'Select…', class: cls = '' } = $props();

	let showAdd = $state(false);
	let newVal = $state('');

	function handleSelect(e) {
		if (e.target.value === '__new__') {
			showAdd = true;
			// reset select to current value visually
			e.target.value = value ?? '';
			return;
		}
		onchange(e.target.value);
	}

	function addNew() {
		const v = newVal.trim();
		if (!v) return;
		onAddCustom?.(v);
		onchange(v);
		newVal = '';
		showAdd = false;
	}

	function cancelAdd() {
		showAdd = false;
		newVal = '';
	}
</script>

<div class="flex flex-col gap-1 {cls}">
	<select
		value={value ?? ''}
		onchange={handleSelect}
		class="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-full focus:outline-none focus:ring-1 focus:ring-teal-500"
	>
		{#if !value}
			<option value="" disabled>{placeholder}</option>
		{/if}
		{#each options as o}
			<option value={o}>{o}</option>
		{/each}
		{#each customOptions as o}
			<option value={o}>{o} ✦</option>
		{/each}
		<option value="__new__">+ Add new…</option>
	</select>

	{#if showAdd}
		<div class="flex gap-1.5">
			<input
				bind:value={newVal}
				placeholder="New value"
				onkeydown={(e) => e.key === 'Enter' && addNew()}
				class="border border-gray-300 rounded px-2 py-1 text-sm flex-1 focus:outline-none focus:ring-1 focus:ring-teal-500"
			/>
			<button onclick={addNew} class="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm">Add</button>
			<button onclick={cancelAdd} class="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm">✕</button>
		</div>
	{/if}
</div>
