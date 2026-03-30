<script lang="ts">
  // PictogramPlaceholder — Coming Soon
  // Future: port ChartFlam's pictogram component (slider for highlighted icons)
</script>

<div class="pictogram-section">
  <div class="divider">
    <span class="divider-text">or</span>
  </div>
  <button class="pictogram-btn secondary" disabled>
    <img src="/icons/icon-pictogram.svg" alt="" width="18" height="18" class="btn-icon" />
    Create a pictogram
    <span class="coming-soon-badge">Coming soon</span>
  </button>
</div>

<style>
  .pictogram-section {
    margin-top: 0.5rem;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--color-border);
  }

  .divider-text {
    font-size: var(--font-size-sm);
    color: var(--text-medium);
  }

  .pictogram-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    font-weight: var(--font-weight-medium);
  }

  .btn-icon {
    opacity: 0.6;
  }

  .coming-soon-badge {
    font-size: var(--font-size-xs);
    color: var(--text-medium);
    background: var(--bg-light);
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm);
    margin-left: 0.25rem;
  }
</style>
