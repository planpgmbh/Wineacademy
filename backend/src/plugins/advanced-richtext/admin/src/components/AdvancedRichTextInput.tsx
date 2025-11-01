import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

const quillModules = {
  toolbar: [
    [{ header: [false, 2, 3, 4] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
};

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
  const [mode, setMode] = useState<Mode>('visual');
  const safeValue = useMemo(() => (typeof value === 'string' ? value : ''), [value]);
  const [htmlValue, setHtmlValue] = useState<string>(safeValue);

  useEffect(() => {
    console.info(
      '[advanced-richtext] AdvancedRichTextInput mount/update – mode=%s, valueLength=%d',
      mode,
      typeof value === 'string' ? value.length : -1
    );
  }, [mode, value]);

  useEffect(() => {
    if (safeValue !== htmlValue) {
      setHtmlValue(safeValue);
    }
  }, [safeValue, htmlValue]);

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
