/**
 * Clipboard utility functions for copying and handling clipboard operations
 */

/**
 * Copies text to clipboard and shows a success or error message
 * @param text The text to copy to clipboard
 * @param successMessage Optional custom success message
 * @param errorPrefix Optional custom error prefix
 * @returns Promise that resolves when the copy operation is complete
 */
export function copyToClipboard(
  text: string, 
  successMessage: string = 'Copied to clipboard', 
  errorPrefix: string = 'Failed to copy'
): Promise<void> {
  return navigator.clipboard.writeText(text)
    .then(() => {
      // Import dynamically to avoid circular dependencies
      import('element-plus').then(({ ElMessage }) => {
        ElMessage.success(successMessage);
      });
    })
    .catch(err => {
      // Import dynamically to avoid circular dependencies
      import('element-plus').then(({ ElMessage }) => {
        ElMessage.error(`${errorPrefix}: ${err}`);
      });
    });
}