/**
 * Simple template renderer for local template preview
 */
export class TemplateRenderer {
  /**
   * Render a template with variables
   */
  static render(template: string, variables: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      return Object.prototype.hasOwnProperty.call(variables, key) && variables[key] !== undefined 
        ? String(variables[key]) 
        : match;
    });
  }

  /**
   * Extract variable names from a template
   */
  static extractVariables(template: string): string[] {
    const matches = template.match(/\{\{(\w+)\}\}/g) || [];
    const variables = matches.map(match => match.slice(2, -2));
    return [...new Set(variables)];
  }

  /**
   * Validate that all required variables are provided
   */
  static validateVariables(
    template: string,
    variables: Record<string, unknown>
  ): { valid: boolean; missing: string[] } {
    const required = this.extractVariables(template);
    const missing = required.filter(key => !(key in variables));
    
    return {
      valid: missing.length === 0,
      missing,
    };
  }
}