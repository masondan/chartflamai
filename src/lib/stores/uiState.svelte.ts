interface UiState {
  activeTab: 'search' | 'source' | 'classic';
  isLoading: boolean;
  showSourcePreview: boolean;
  previewText: string;
  rateLimited: boolean;
  expandedAngleId: string | null;
  activeDrawer: 'sources' | 'data' | 'explain' | null;
  activeDrawerAngleId: string | null;
  onAngleToggle?: (angleId: string) => void;
  onDrawerOpen?: () => void;
}

function createUiState() {
  let state = $state<UiState>({
    activeTab: 'classic',
    isLoading: false,
    showSourcePreview: false,
    previewText: '',
    rateLimited: false,
    expandedAngleId: null,
    activeDrawer: null,
    activeDrawerAngleId: null
  });

  return {
    get value() { return state; },
    setTab(tab: UiState['activeTab']) { state.activeTab = tab; },
    setLoading(loading: boolean) { state.isLoading = loading; },
    toggleAngle(angleId: string) {
      state.expandedAngleId = state.expandedAngleId === angleId ? null : angleId;
      state.onAngleToggle?.(angleId);
    },
    expandAngle(angleId: string) {
      state.expandedAngleId = angleId;
    },
    openDrawer(drawer: NonNullable<UiState['activeDrawer']>, angleId: string) {
      state.activeDrawer = drawer;
      state.activeDrawerAngleId = angleId;
      state.onDrawerOpen?.();
    },
    closeDrawer() {
      state.activeDrawer = null;
      state.activeDrawerAngleId = null;
    },
    setAngleToggleCallback(callback: (angleId: string) => void) {
      state.onAngleToggle = callback;
    },
    setDrawerOpenCallback(callback: () => void) {
      state.onDrawerOpen = callback;
    }
  };
}

export const uiState = createUiState();
