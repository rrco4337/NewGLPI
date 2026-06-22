import type { Config } from 'tailwindcss'
import daisyui from 'daisyui'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        /* System fonts only — no external CDN */
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue',
          'Roboto', 'Oxygen', 'Ubuntu', 'Arial', 'sans-serif',
        ],
        mono: [
          'SFMono-Regular', 'ui-monospace', 'Consolas', 'Liberation Mono',
          'Courier New', 'monospace',
        ],
      },
      colors: {
        primary:   '#4a5c22',   /* army-600  */
        secondary: '#3a491a',   /* army-700  */
        accent:    '#b4d462',   /* army-lime */
        army: {
          50:  '#f4f7e8',
          100: '#e4ecd0',
          200: '#c8d89e',
          300: '#a5be68',
          400: '#7a9640',
          500: '#5b7429',
          600: '#4a5c22',
          700: '#3a491a',
          800: '#2a3512',
          900: '#1c2408',
          950: '#111509',
        },
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        army: {
          primary:    '#4a5c22',   /* army-600    */
          secondary:  '#3a491a',   /* army-700    */
          accent:     '#b4d462',   /* lime        */
          neutral:    '#1c2408',   /* army-900    */
          'base-100': '#ffffff',
          'base-200': '#f4f7e8',   /* army-50     */
          'base-300': '#e4ecd0',   /* army-100    */
          success:    '#059669',   /* emerald-600 */
          warning:    '#d97706',   /* amber-600   */
          error:      '#dc2626',   /* red-600     */
          info:       '#4a5c22',   /* army-600    */
        },
      },
    ],
  },
} satisfies Config
