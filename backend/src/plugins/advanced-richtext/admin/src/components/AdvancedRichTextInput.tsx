import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Box, Button, Field, Flex, SingleSelect, SingleSelectOption, Textarea, VisuallyHidden } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import '../styles.css';
import pluginId from '../pluginId';
import {
  Link as LinkIcon,
  Cross,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  BulletList as BulletListIcon,
  NumberList as NumberListIcon,
} from '@strapi/icons';

const Quill = ReactQuill.Quill;
const HEADING_SIZE_VALUES = ['xs', 's', 'm', 'l'] as const;
type HeadingSizeValue = (typeof HEADING_SIZE_VALUES)[number];
const HEADING_SIZE_WHITELIST: string[] = [...HEADING_SIZE_VALUES, 'small', 'large', 'standard'];
const LEGACY_HEADING_SIZE_MAP: Record<string, HeadingSizeValue> = {
  small: 's',
  large: 'l',
  standard: 'm'
};

const HEADING_LEVEL_VALUES = ['none', '2', '3', '4'] as const;
type HeadingLevelValue = (typeof HEADING_LEVEL_VALUES)[number];

if (Quill) {
  try {
    const Parchment = Quill.import('parchment');
    const existing = (() => {
      try {
        return Quill.import('formats/heading-size');
      } catch {
        return null;
      }
    })();

    if (existing) {
      existing.whitelist = [...HEADING_SIZE_WHITELIST];
    } else {
      const headingSizeAttributor = new Parchment.Attributor.Class('heading-size', 'rt-heading', {
        scope: Parchment.Scope.BLOCK,
        whitelist: HEADING_SIZE_WHITELIST
      });
      Quill.register(headingSizeAttributor, true);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[advanced-richtext] heading-size registration failed:', error);
  }
}

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

const quillFormats = ['header', 'bold', 'italic', 'underline', 'list', 'bullet', 'link', 'heading-size'];

const ToolbarButton = styled.button.attrs({ type: 'button' })`
  background-color: var(--ds-colors-neutral0);
  box-shadow: inset 0 0 0 1px var(--ds-colors-neutral200);
  color: var(--ds-colors-neutral700);
  min-height: 3.2rem;
  height: 3.2rem;
  min-width: 3rem;
  padding: 0 0.85rem;
  border-radius: 0;
  border: 1px solid var(--ds-colors-neutral200);
  margin: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font: inherit;
  background-clip: padding-box;
  gap: 0.35rem;
  transition: background-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease;

  &:hover:not(:disabled) {
    border-color: var(--ds-colors-neutral300);
    background-color: var(--ds-colors-neutral100);
  }

  &:focus-visible {
    outline: 2px solid var(--ds-colors-primary500);
    outline-offset: 2px;
  }

  &[aria-pressed='true'],
  &[data-active='true'] {
    box-shadow: inset 0 0 0 1px var(--ds-colors-neutral400);
    border-color: var(--ds-colors-neutral400);
    background-color: var(--ds-colors-neutral050);
    color: var(--ds-colors-primary600);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

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
  const isVisualMode = mode === 'visual';
  const toolbarDisabled = disabled || !isVisualMode;

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

  const htmlLabel = formatMessage({
    id: `${pluginId}.field.toggle.html`,
    defaultMessage: 'HTML',
  });
  const previewLabel = formatMessage({
    id: `${pluginId}.field.toggle.preview`,
    defaultMessage: 'Preview',
  });
  const boldLabel = formatMessage({
    id: `${pluginId}.field.action.bold`,
    defaultMessage: 'Bold',
  });
  const italicLabel = formatMessage({
    id: `${pluginId}.field.action.italic`,
    defaultMessage: 'Italic',
  });
  const underlineLabel = formatMessage({
    id: `${pluginId}.field.action.underline`,
    defaultMessage: 'Underline',
  });
  const orderedListLabel = formatMessage({
    id: `${pluginId}.field.action.orderedList`,
    defaultMessage: 'Ordered list',
  });
  const bulletListLabel = formatMessage({
    id: `${pluginId}.field.action.bulletList`,
    defaultMessage: 'Bullet list',
  });
  const modeToggleLabel = isVisualMode ? htmlLabel : previewLabel;
  const linkLabel = formatMessage({
    id: `${pluginId}.field.action.link`,
    defaultMessage: 'Insert link',
  });
  const clearLabel = formatMessage({
    id: `${pluginId}.field.action.clear`,
    defaultMessage: 'Clear formatting',
  });
  const headingSizeXSLabel = formatMessage({
    id: `${pluginId}.field.headingSize.xs`,
    defaultMessage: 'XS',
  });
  const headingSizeSLabel = formatMessage({
    id: `${pluginId}.field.headingSize.s`,
    defaultMessage: 'S',
  });
  const headingSizeMLabel = formatMessage({
    id: `${pluginId}.field.headingSize.m`,
    defaultMessage: 'M',
  });
  const headingSizeLLabel = formatMessage({
    id: `${pluginId}.field.headingSize.l`,
    defaultMessage: 'L',
  });
  const headingSizeGroupLabel = formatMessage({
    id: `${pluginId}.field.headingSize.groupLabel`,
    defaultMessage: 'Heading size',
  });
  const headingLevelGroupLabel = formatMessage({
    id: `${pluginId}.field.headingLevel.groupLabel`,
    defaultMessage: 'Heading level',
  });
  const headingLevelNoneLabel = formatMessage({
    id: `${pluginId}.field.headingLevel.none`,
    defaultMessage: 'Text',
  });
  const headingLevelOptions = useMemo(
    () => [
      { value: 'none' as HeadingLevelValue, label: headingLevelNoneLabel },
      { value: '2' as HeadingLevelValue, label: 'H2' },
      { value: '3' as HeadingLevelValue, label: 'H3' },
      { value: '4' as HeadingLevelValue, label: 'H4' }
    ],
    [headingLevelNoneLabel]
  );
  const headingSizeOptions = useMemo(
    () => [
      { value: 'xs' as HeadingSizeValue, label: headingSizeXSLabel },
      { value: 's' as HeadingSizeValue, label: headingSizeSLabel },
      { value: 'm' as HeadingSizeValue, label: headingSizeMLabel },
      { value: 'l' as HeadingSizeValue, label: headingSizeLLabel }
    ],
    [headingSizeXSLabel, headingSizeSLabel, headingSizeMLabel, headingSizeLLabel]
  );

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
    instance.format('heading-size', false);
    setActiveFormats(instance.getFormat());
  }, [getEditor]);

  const rawHeadingSize = activeFormats?.['heading-size'] as string | undefined;
  const hasHeadingFormat = Boolean(activeFormats?.header);
  const activeHeadingLevel = hasHeadingFormat ? ((activeFormats?.header as 2 | 3 | 4 | undefined) ?? null) : null;

  const applyHeadingLevel = useCallback(
    (level: 2 | 3 | 4 | null) => {
      const instance = getEditor();
      if (!instance) return;
      instance.focus();
      if (level) {
        instance.format('header', level);
        const formats = instance.getFormat();
        if (!formats?.['heading-size']) {
          instance.format('heading-size', 'm');
        }
      } else {
        instance.format('header', false);
        instance.format('heading-size', false);
      }
      setActiveFormats(instance.getFormat());
    },
    [getEditor]
  );

  const setHeadingSize = useCallback(
    (value: HeadingSizeValue) => {
      const instance = getEditor();
      if (!instance) return;
      instance.focus();
      instance.format('heading-size', value);
      setActiveFormats(instance.getFormat());
    },
    [getEditor]
  );

  useEffect(() => {
    if (!hasHeadingFormat || !rawHeadingSize) {
      return;
    }
    if (!HEADING_SIZE_VALUES.includes(rawHeadingSize as HeadingSizeValue)) {
      const mapped = LEGACY_HEADING_SIZE_MAP[rawHeadingSize];
      if (mapped) {
        setHeadingSize(mapped);
      }
    }
  }, [hasHeadingFormat, rawHeadingSize, setHeadingSize]);

  const handleHeadingSizeSelect = useCallback(
    (value: HeadingSizeValue) => {
      if (!hasHeadingFormat) {
        return;
      }
      if (HEADING_SIZE_VALUES.includes(value)) {
        setHeadingSize(value);
      }
    },
    [hasHeadingFormat, setHeadingSize]
  );

  const normalisedHeadingSize =
    rawHeadingSize && HEADING_SIZE_VALUES.includes(rawHeadingSize as HeadingSizeValue)
      ? (rawHeadingSize as HeadingSizeValue)
      : rawHeadingSize && LEGACY_HEADING_SIZE_MAP[rawHeadingSize]
        ? LEGACY_HEADING_SIZE_MAP[rawHeadingSize]
        : undefined;

  const currentHeadingSize: HeadingSizeValue = hasHeadingFormat ? normalisedHeadingSize ?? 'm' : 'm';
  const currentHeadingLevel: HeadingLevelValue = activeHeadingLevel ? (String(activeHeadingLevel) as HeadingLevelValue) : 'none';

  const handleHeadingLevelSelect = useCallback(
    (value: HeadingLevelValue) => {
      if (value === 'none') {
        applyHeadingLevel(null);
        return;
      }
      if (value === '2' || value === '3' || value === '4') {
        applyHeadingLevel(Number(value) as 2 | 3 | 4);
      }
    },
    [applyHeadingLevel]
  );

  const handleSetVisualMode = useCallback(() => {
    setMode('visual');
  }, [setMode]);

  const handleSetHtmlMode = useCallback(() => {
    setMode('html');
  }, [setMode]);

  const handleModeToggle = useCallback(() => {
    if (isVisualMode) {
      handleSetHtmlMode();
    } else {
      handleSetVisualMode();
    }
  }, [handleSetHtmlMode, handleSetVisualMode, isVisualMode]);

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
        <Field.Label action={labelAction} required={required}>
          {label}
        </Field.Label>

        <div className="advanced-richtext__toolbar-wrapper">
          <Flex
            className="advanced-richtext__toolbar"
            gap={2}
            paddingTop={2}
            wrap="wrap"
            alignItems="center"
            justifyContent="space-between"
            role="toolbar"
            aria-label="Richtext Werkzeuge"
          >
            <Flex className="advanced-richtext__toolbar-left" alignItems="center" gap={3} wrap="wrap">
              <div className="advanced-richtext__select-group">
                <div className="advanced-richtext__select">
                  <SingleSelect
                    label={headingLevelGroupLabel}
                    labelAction={undefined}
                    placeholder={headingLevelGroupLabel}
                    size="S"
                    value={currentHeadingLevel}
                    onChange={(value) => handleHeadingLevelSelect((value ?? 'none') as HeadingLevelValue)}
                    disabled={!isVisualMode}
                  >
                    {headingLevelOptions.map((option) => (
                      <SingleSelectOption key={option.value} value={option.value}>
                        {option.label}
                      </SingleSelectOption>
                    ))}
                  </SingleSelect>
                </div>

                <div className="advanced-richtext__select">
                  <SingleSelect
                    label={headingSizeGroupLabel}
                    labelAction={undefined}
                    placeholder={headingSizeGroupLabel}
                    size="S"
                    value={currentHeadingSize}
                    onChange={(value) => handleHeadingSizeSelect((value ?? 'm') as HeadingSizeValue)}
                    disabled={!hasHeadingFormat || !isVisualMode}
                  >
                    {headingSizeOptions.map((option) => (
                      <SingleSelectOption key={option.value} value={option.value}>
                        {option.label}
                      </SingleSelectOption>
                    ))}
                  </SingleSelect>
                </div>
              </div>

              <div className="advanced-richtext__toolbar-cluster">
                <ToolbarButton
                  onClick={() => toggleFormat('bold')}
                  disabled={toolbarDisabled}
                  aria-pressed={Boolean(activeFormats?.bold)}
                  data-active={Boolean(activeFormats?.bold)}
                  className="advanced-richtext__toolbar-button advanced-richtext__toolbar-button--first"
                  aria-label={boldLabel}
                >
                  <BoldIcon aria-hidden />
                  <VisuallyHidden>{boldLabel}</VisuallyHidden>
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => toggleFormat('italic')}
                  disabled={toolbarDisabled}
                  aria-pressed={Boolean(activeFormats?.italic)}
                  data-active={Boolean(activeFormats?.italic)}
                  className="advanced-richtext__toolbar-button"
                  aria-label={italicLabel}
                >
                  <ItalicIcon aria-hidden />
                  <VisuallyHidden>{italicLabel}</VisuallyHidden>
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => toggleFormat('underline')}
                  disabled={toolbarDisabled}
                  aria-pressed={Boolean(activeFormats?.underline)}
                  data-active={Boolean(activeFormats?.underline)}
                  className="advanced-richtext__toolbar-button advanced-richtext__toolbar-button--last"
                  aria-label={underlineLabel}
                >
                  <UnderlineIcon aria-hidden />
                  <VisuallyHidden>{underlineLabel}</VisuallyHidden>
                </ToolbarButton>
              </div>

              <div className="advanced-richtext__toolbar-cluster">
                <ToolbarButton
                  onClick={() => toggleList('ordered')}
                  disabled={toolbarDisabled}
                  aria-pressed={activeFormats?.list === 'ordered'}
                  data-active={activeFormats?.list === 'ordered'}
                  className="advanced-richtext__toolbar-button advanced-richtext__toolbar-button--first"
                  aria-label={orderedListLabel}
                >
                  <NumberListIcon aria-hidden />
                  <VisuallyHidden>{orderedListLabel}</VisuallyHidden>
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => toggleList('bullet')}
                  disabled={toolbarDisabled}
                  aria-pressed={activeFormats?.list === 'bullet'}
                  data-active={activeFormats?.list === 'bullet'}
                  className="advanced-richtext__toolbar-button advanced-richtext__toolbar-button--last"
                  aria-label={bulletListLabel}
                >
                  <BulletListIcon aria-hidden />
                  <VisuallyHidden>{bulletListLabel}</VisuallyHidden>
                </ToolbarButton>
              </div>

              <div className="advanced-richtext__toolbar-cluster">
                <ToolbarButton
                  onClick={insertLink}
                  disabled={toolbarDisabled}
                  aria-pressed={Boolean(activeFormats?.link)}
                  data-active={Boolean(activeFormats?.link)}
                  className="advanced-richtext__toolbar-button advanced-richtext__toolbar-button--first"
                  aria-label={linkLabel}
                >
                  <LinkIcon aria-hidden />
                  <VisuallyHidden>{linkLabel}</VisuallyHidden>
                </ToolbarButton>
                <ToolbarButton
                  onClick={clearFormats}
                  disabled={toolbarDisabled}
                  aria-label={clearLabel}
                  className="advanced-richtext__toolbar-button advanced-richtext__toolbar-button--last"
                >
                  <Cross aria-hidden />
                  <VisuallyHidden>{clearLabel}</VisuallyHidden>
                </ToolbarButton>
              </div>
            </Flex>

            <Button
              type="button"
              size="S"
              className="advanced-richtext__mode-toggle"
              variant={mode === 'html' ? 'default' : 'tertiary'}
              onClick={handleModeToggle}
              aria-pressed={!isVisualMode}
            >
              {modeToggleLabel}
            </Button>
          </Flex>
        </div>

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
