import { useEffect, useState } from 'react';
import { Parser, Language } from 'web-tree-sitter';

export const useTreeSitter = (languagePath: string = '/tree-sitter-javascript.wasm') => {
  const [parser, setParser] = useState<Parser | null>(null);
  const [language, setLanguage] = useState<Language | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Resolve paths relative to the base URL (for GitHub Pages)
        const resolvePath = (path: string) => {
            const base = import.meta.env.BASE_URL;
            const cleanPath = path.startsWith('/') ? path.slice(1) : path;
            return `${base}${cleanPath}`;
        };

        // Initialize web-tree-sitter
        // We point to the wasm file in the public directory
        await Parser.init({
          locateFile(scriptName: string) {
            return resolvePath(scriptName);
          },
        });

        const parser = new Parser();
        
        // Load the language using window.fetch as requested
        const resolvedLangPath = resolvePath(languagePath);
        const response = await window.fetch(resolvedLangPath);
        if (!response.ok) {
            throw new Error(`Failed to fetch language file: ${resolvedLangPath} (Status: ${response.status})`);
        }
        const bytes = await response.arrayBuffer();
        const lang = await Language.load(new Uint8Array(bytes));
        
        parser.setLanguage(lang);

        setParser(parser);
        setLanguage(lang);
        setLoading(false);
      } catch (e) {
        console.error("Failed to initialize tree-sitter:", e);
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      }
    };

    init();
  }, [languagePath]);

  return { parser, language, loading, error };
};
