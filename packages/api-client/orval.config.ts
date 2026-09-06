import { defineConfig } from 'orval';

const input = {
  target: './openapi.json',
};

export default defineConfig({
  api: {
    input,
    output: {
      clean: true,
      client: 'swr',
      httpClient: 'fetch',
      mode: 'tags-split',
      target: './src/generated/endpoints',
      schemas: './src/generated/models',
      override: {
        mutator: {
          path: './src/http/client.ts',
          name: 'customFetch',
        },
        fetch: {
          includeHttpResponseReturnType: false,
        },
      },
    },
  },
  validation: {
    input,
    output: {
      clean: true,
      client: 'zod',
      mode: 'tags-split',
      target: './src/generated/validation',
      fileExtension: '.zod.ts',
      override: {
        zod: {
          version: 4,
          variant: 'classic',
          generate: {
            body: true,
            query: true,
            param: true,
            header: false,
            response: false,
          },
          generateReusableSchemas: true,
        },
      },
    },
  },
});
