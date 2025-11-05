import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Field, Flex, Textarea, Typography } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import '../styles.css';
import pluginId from '../pluginId';

type Mode = 'visual' | 'html';

type IntlMessage = {
  id?: string;
  defaultMessage?: string;
  values?: Record<string, unknown>;
};

type AdvancedRichTextInputProps = {
  attribute: { type?: string };
  description?: IntlMessage | string | null;
  disabled?: boolean;
  error?: string | null;
  intlLabel?: IntlMessage;
  labelAction?: React.ReactNode;
  name: string;
  onChange: (event: { target: { name: string; type?: string; value: string } }) => void;
  placeholder?: string;
  required?: boolean;
  value?: string | null;
};

const quillModules = { toolbar: false };

const quillFormats = ['header', 'bold', 'italic', 'underline', 'list', 'bullet', 'link'];

const AdvancedRichTextInput: React.FC<AdvancedRichTextInputProps> = ({
  attribute,
  description,
  disabled = false,
  error,
  intlLabel,
  labelAction,
  name,
  onChange,
  placeholder,
  required = false,
  value,
}) => {
  const { formatMessage } = useIntl();
  const quillRef = useRef<ReactQuill | null>(null);
  const [mode, setMode] = useState<Mode>('visual');
  const safeValue = useMemo(() => (typeof value === 'string' ? value : ''), [value]);
  const [htmlValue, setHtmlValue] = useState<string>(safeValue);
  const [activeFormats, setActiveFormats] = useState<Record<string, any>>({});
  const lastPropValueRef = useRef(safeValue);

  useEffect(() => {
    if (safeValue !== lastPropValueRef.current) {
      setHtmlValue(safeValue);
      lastPropValueRef.current = safeValue;
    }
  }, [safeValue]);

  const label = intlLabel?.id
    ? formatMessage(intlLabel)
    : intlLabel?.defaultMessage ?? name;

  const hint =
    typeof description === 'string'
      ? description
      : description?.id
      ? formatMessage(description)
      : description?.defaultMessage;

  const handleChange = useCallback(
    (nextValue: string) => {
      setHtmlValue(nextValue);
      onChange({
        target: {
          name,
          value: nextValue,
          type: attribute?.type ?? 'customField',
        },
      });
    },
    [attribute?.type, name, onChange]
  );

  const handleVisualChange = useCallback(
    (nextValue: string) => {
      handleChange(nextValue);
    },
    [handleChange]
  );

  const handleHtmlChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleChange(event.target.value);
    },
    [handleChange]
  );

  const visualLabel = formatMessage({
    id: `${pluginId}.field.toggle.visual`,
    defaultMessage: 'Visual',
  });
  const htmlLabel = formatMessage({
    id: `${pluginId}.field.toggle.html`,
    defaultMessage: 'HTML',
  });

  const getEditor = useCallback(() => quillRef.current?.getEditor() ?? null, []);

  const toggleFormat = useCallback(
    (format: string, value?: any) => {
      const instance = getEditor();
      if (!instance) return;
      instance.focus();
      const isActive = Boolean(activeFormats?.[format]);
      instance.format(format, isActive ? false : value ?? true);
      setActiveFormats(instance.getFormat());
    },
    [getEditor, activeFormats]
  );

  const toggleHeader = useCallback(
    (level: 2 | 3 | 4) => {
      const instance = getEditor();
      if (!instance) return;
      instance.focus();
      const current = activeFormats?.header;
      instance.format('header', current === level ? false : level);
      setActiveFormats(instance.getFormat());
    },
    [getEditor, activeFormats]
  );

  const toggleList = useCallback(
    (type: 'ordered' | 'bullet') => {
      const instance = getEditor();
      if (!instance) return;
      instance.focus();
      const current = activeFormats?.list;
      instance.format('list', current === type ? false : type);
      setActiveFormats(instance.getFormat());
    },
    [getEditor, activeFormats]
  );

  const insertLink = useCallback(() => {
    const instance = getEditor();
    if (!instance) return;
    instance.focus();
    const currentUrl = activeFormats?.link ?? '';
    const url = window.prompt('Link-Adresse eingeben', currentUrl || 'https://');
    if (url == null) return;
    if (url.trim() === '') {
      instance.format('link', false);
    } else {
      instance.format('link', url.trim());
    }
    setActiveFormats(instance.getFormat());
  }, [getEditor, activeFormats]);

  const clearFormats = useCallback(() => {
    const instance = getEditor();
    if (!instance) return;
    const range = instance.getSelection();
    if (!range) {
      instance.focus();
      return;
    }
    instance.removeFormat(range.index, range.length || instance.getLength());
    setActiveFormats(instance.getFormat());
  }, [getEditor]);

  useEffect(() => {
    const editorInstance = getEditor();
    if (!editorInstance) return;

    const handleSelectionChange = (range: any) => {
      if (!range) {
        setActiveFormats({});
        return;
      }
      const formats = editorInstance.getFormat(range.index, range.length);
      setActiveFormats(formats);
    };

    editorInstance.on('selection-change', handleSelectionChange);
    setActiveFormats(editorInstance.getFormat());

    return () => {
      editorInstance.off('selection-change', handleSelectionChange);
    };
  }, [getEditor]);

  return (
    <Field.Root name={name} id={name} error={error} hint={hint} required={required}>
      <>
        <Flex alignItems="center" justifyContent="space-between" gap={2}>
          <Field.Label action={labelAction} required={required}>
            {label}
          </Field.Label>
          <Flex gap={2}>
            <Button
              type="button"
              size="S"
              variant={mode === 'visual' ? 'default' : 'tertiary'}
              onClick={() => setMode('visual')}
              aria-pressed={mode === 'visual'}
            >
              <Typography as="span" fontWeight={mode === 'visual' ? 'bold' : undefined}>
                {visualLabel}
              </Typography>
            </Button>
            <Button
              type="button"
              size="S"
              variant={mode === 'html' ? 'default' : 'tertiary'}
              onClick={() => setMode('html')}
              aria-pressed={mode === 'html'}
            >
              <Typography as="span" fontWeight={mode === 'html' ? 'bold' : undefined}>
                {htmlLabel}
              </Typography>
            </Button>
          </Flex>
        </Flex>

        {mode === 'visual' && (
          <div className="advanced-richtext__toolbar-wrapper">
            <Flex
              className="advanced-richtext__toolbar"
              gap={2}
              paddingTop={2}
              wrap="wrap"
              role="toolbar"
              aria-label="Richtext Werkzeuge"
            >
              <Flex gap={1} className="advanced-richtext__toolbar-group">
                {[2, 3, 4].map((level) => (
                  <Button
                    key={level}
                    type="button"
                    size="S"
                    variant={activeFormats?.header === level ? 'default' : 'tertiary'}
                    onClick={() => toggleHeader(level as 2 | 3 | 4)}
                    style={{ minWidth: '2.5rem' }}
                  >
                    <Typography as="span">{`H${level}`}</Typography>
                  </Button>
                ))}
              </Flex>
              <Flex gap={1} className="advanced-richtext__toolbar-group">
                <Button
                  type="button"
                  size="S"
                  variant={activeFormats?.bold ? 'default' : 'tertiary'}
                  onClick={() => toggleFormat('bold')}
                  style={{ minWidth: '2.5rem' }}
                >
                  <Typography as="span">B</Typography>
                </Button>
                <Button
                  type="button"
                  size="S"
                  variant={activeFormats?.italic ? 'default' : 'tertiary'}
                  onClick={() => toggleFormat('italic')}
                  style={{ minWidth: '2.5rem' }}
                >
                  <Typography as="span" fontStyle="italic">
                    I
                  </Typography>
                </Button>
                <Button
                  type="button"
                  size="S"
                  variant={activeFormats?.underline ? 'default' : 'tertiary'}
                  onClick={() => toggleFormat('underline')}
                  style={{ minWidth: '2.5rem' }}
                >
                  <Typography as="span" textDecoration="underline">
                    U
                  </Typography>
                </Button>
              </Flex>
              <Flex gap={1} className="advanced-richtext__toolbar-group">
                <Button
                  type="button"
                  size="S"
                  variant={activeFormats?.list === 'ordered' ? 'default' : 'tertiary'}
                  onClick={() => toggleList('ordered')}
                  style={{ minWidth: '2.5rem' }}
                >
                  <Typography as="span">1.</Typography>
                </Button>
                <Button
                  type="button"
                  size="S"
                  variant={activeFormats?.list === 'bullet' ? 'default' : 'tertiary'}
                  onClick={() => toggleList('bullet')}
                  style={{ minWidth: '2.5rem' }}
                >
                  <Typography as="span">•</Typography>
                </Button>
              </Flex>
              <Flex gap={1} className="advanced-richtext__toolbar-group">
                <Button
                  type="button"
                  size="S"
                  variant={activeFormats?.link ? 'default' : 'tertiary'}
                  onClick={insertLink}
                  style={{ minWidth: '3.5rem' }}
                >
                  <Typography as="span">Link</Typography>
                </Button>
                <Button
                  type="button"
                  size="S"
                  variant="tertiary"
                  onClick={clearFormats}
                  style={{ minWidth: '3.5rem' }}
                >
                  <Typography as="span">Clear</Typography>
                </Button>
              </Flex>
            </Flex>
          </div>
        )}

        <Box paddingTop={2}>
          {mode === 'visual' ? (
            <Box
              className="advanced-richtext__editor"
              hasRadius
              borderColor="neutral200"
              borderStyle="solid"
              borderWidth="1px"
              background="neutral0"
            >
              <ReactQuill
                theme="snow"
                value={htmlValue}
                onChange={handleVisualChange}
                readOnly={disabled}
                modules={quillModules}
                formats={quillFormats}
                placeholder={placeholder}
                ref={quillRef}
              />
            </Box>
          ) : (
            <Textarea
              value={htmlValue}
              onChange={handleHtmlChange}
              disabled={disabled}
              placeholder={placeholder}
              spellCheck="false"
              rows={12}
            />
          )}
        </Box>

        <Box paddingTop={1}>
          <Field.Hint />
          <Field.Error />
        </Box>
      </>
    </Field.Root>
  );
};

export default AdvancedRichTextInput;
