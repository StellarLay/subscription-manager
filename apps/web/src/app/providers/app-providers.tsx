import {
  ColorSchemeScript,
  createTheme,
  MantineProvider,
  type MantineColorsTuple,
} from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';

const accent: MantineColorsTuple = [
  '#eeefff',
  '#dcddff',
  '#b8b8ff',
  '#9290ff',
  '#746ffc',
  '#625af9',
  '#5a4ff9',
  '#493ee0',
  '#3e36c8',
  '#312eae',
];

const theme = createTheme({
  primaryColor: 'accent',
  colors: { accent },
  defaultRadius: 'md',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  headings: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
});

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <>
      <ColorSchemeScript defaultColorScheme="dark" />
      <MantineProvider defaultColorScheme="dark" theme={theme}>
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
