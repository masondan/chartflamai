<script lang="ts">
  // EditDrawer — Coming Soon
  // Future: port ChartFlam's edit controls (colours, labels, legend, fonts, spacing)
</script>

<div class="edit-drawer-placeholder">
  <div class="placeholder-icon">
    <img src="/icons/icon-edit-fill.svg" alt="" width="48" height="48" />
  </div>
  <h3>Chart Editor</h3>
  <p>Customisation options coming soon</p>
  <p class="sub">Colours, labels, legends, fonts and more</p>
</div>

<style>
  .edit-drawer-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    text-align: center;
    min-height: 200px;
  }

  .placeholder-icon {
    margin-bottom: 1rem;
    opacity: 0.3;
  }

  h3 {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    margin-bottom: 0.5rem;
    color: var(--text-dark);
  }

  p {
    color: var(--text-medium);
    margin-bottom: 0.25rem;
  }

  .sub {
    font-size: var(--font-size-sm);
    color: var(--text-medium);
  }
</style>
