import {
  ColorSchemeScript,
  createTheme,
  MantineProvider,
  type MantineColorsTuple,
} from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';

const signal: MantineColorsTuple = [
  '#efffeb',
  '#ddffd6',
  '#baffad',
  '#94ff80',
  '#73ff5b',
  '#5ee940',
  '#45c82d',
  '#32a51f',
  '#278219',
  '#1c6410',
];

const theme = createTheme({
  primaryColor: 'signal',
  primaryShade: 4,
  colors: { signal },
  defaultRadius: 'lg',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  headings: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
});

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <>
      <ColorSchemeScript defaultColorScheme="dark" />
      <MantineProvider defaultColorScheme="dark" forceColorScheme="dark" theme={theme}>
        <SWRConfig
          value={{
            errorRetryCount: 2,
            revalidateOnFocus: false,
            shouldRetryOnError: true,
          }}
        >
          <Notifications position="top-right" />
          {children}
        </SWRConfig>
      </MantineProvider>
    </>
  );
}
