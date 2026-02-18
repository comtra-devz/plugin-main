# Code Generation

## Templates
Use Handlebars/EJS for robust output:
```javascript
export const {{Name}} = ({ {{props}} }) => (
  <div className="{{token_classes}}">...</div>
)
```

## Storybook Integration
1. Generate `.stories.tsx` automatically.
2. Add "DS-Compliant" badge to stories passing audit.
3. Sync via CLI or GitHub Action from the plugin backend.