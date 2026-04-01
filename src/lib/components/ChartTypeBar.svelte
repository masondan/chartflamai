<script lang="ts">
  import type { ChartType } from '$lib/config/design';

  interface Props {
    compatibleTypes: ChartType[];
    selectedType: ChartType;
    onselect: (type: ChartType) => void;
  }

  let { compatibleTypes, selectedType, onselect }: Props = $props();

  const allTypes: Array<{ id: ChartType; label: string; icon: string }> = [
    { id: 'pie', label: 'Pie', icon: '/icons/icon-pie-chart.svg' },
    { id: 'bar', label: 'Bar', icon: '/icons/icon-vertical-bars.svg' },
    { id: 'line', label: 'Line', icon: '/icons/icon-line-chart.svg' }
  ];
</script>

<div class="chart-type-bar" role="toolbar" aria-label="Chart type selector">
  {#each allTypes as type}
    {@const isSelected = selectedType === type.id}
    <button
      class="type-btn"
      class:selected={isSelected}
      onclick={() => onselect(type.id)}
      title={type.label}
      aria-label={type.label}
      aria-pressed={isSelected}
    >
      <img src={type.icon} alt="" class="type-icon" />
    </button>
  {/each}
</div>

<style>
  .chart-type-bar {
    display: flex;
    gap: 0.25rem;
    justify-content: flex-end;
    padding-right: 0.5rem;
  }

  .type-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 6px;
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    min-height: 34px;
    min-width: 34px;
    transition: all var(--duration-fast) ease;
  }

  .type-btn:hover {
    background: var(--color-highlight);
  }

  .type-btn.selected {
    background: var(--color-highlight);
  }

  .type-icon {
    width: 20px;
    height: 20px;
    filter: brightness(0) saturate(100%);
  }

  .type-btn.selected .type-icon {
    filter: brightness(0) saturate(100%) invert(15%) sepia(80%) saturate(4000%) hue-rotate(260deg);
  }
</style>
