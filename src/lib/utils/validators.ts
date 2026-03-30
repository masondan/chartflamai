import type { ApiResponse, AngleData } from '$lib/stores/aiState.svelte';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  data?: ApiResponse;
}

function validateAngle(angle: unknown, index: number): string[] {
  const errors: string[] = [];
  const a = angle as Record<string, unknown>;

  if (!a || typeof a !== 'object') {
    return [`Angle ${index + 1}: not an object`];
  }
  if (typeof a.headline !== 'string' || !a.headline) {
    errors.push(`Angle ${index + 1}: missing headline`);
  }
  if (typeof a.summary !== 'string' || !a.summary) {
    errors.push(`Angle ${index + 1}: missing summary`);
  }
  if (typeof a.suggestedChartType !== 'string') {
    errors.push(`Angle ${index + 1}: missing suggestedChartType`);
  }
  if (!Array.isArray(a.compatibleChartTypes) || a.compatibleChartTypes.length === 0) {
    errors.push(`Angle ${index + 1}: missing compatibleChartTypes`);
  }

  const data = a.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== 'object') {
    errors.push(`Angle ${index + 1}: missing data`);
  } else {
    if (!Array.isArray(data.labels) || data.labels.length === 0) {
      errors.push(`Angle ${index + 1}: missing or empty labels`);
    }
    if (!Array.isArray(data.datasets) || data.datasets.length === 0) {
      errors.push(`Angle ${index + 1}: missing or empty datasets`);
    } else {
      (data.datasets as Array<Record<string, unknown>>).forEach((ds, di) => {
        if (!Array.isArray(ds.data) || ds.data.length === 0) {
          errors.push(`Angle ${index + 1}, dataset ${di + 1}: missing data array`);
        } else if (!ds.data.every((v: unknown) => typeof v === 'number')) {
          errors.push(`Angle ${index + 1}, dataset ${di + 1}: data contains non-numeric values`);
        }
      });
    }
  }

  return errors;
}

export function validateAngleResponse(json: unknown): ValidationResult {
  const errors: string[] = [];

  if (!json || typeof json !== 'object') {
    return { valid: false, errors: ['Response is not an object'] };
  }

  const resp = json as Record<string, unknown>;

  if (!Array.isArray(resp.angles)) {
    return { valid: false, errors: ['Missing angles array'] };
  }

  if (resp.angles.length === 0) {
    return { valid: false, errors: ['No angles returned'] };
  }

  // Validate each angle, collect those that pass
  const validAngles: AngleData[] = [];
  resp.angles.forEach((angle: unknown, i: number) => {
    const angleErrors = validateAngle(angle, i);
    if (angleErrors.length === 0) {
      const a = angle as AngleData;
      // Ensure ID exists
      if (!a.id) a.id = `angle_${i + 1}`;
      // Ensure explain exists
      if (!a.explain) a.explain = a.summary || '';
      // Ensure sources exists
      if (!Array.isArray(a.sources)) a.sources = [];
      validAngles.push(a);
    } else {
      errors.push(...angleErrors);
    }
  });

  // Graceful degradation: if at least 1 angle is valid, return those
  if (validAngles.length > 0) {
    const result = json as ApiResponse;
    result.angles = validAngles;
    return { valid: true, errors, data: result };
  }

  return { valid: false, errors };
}
