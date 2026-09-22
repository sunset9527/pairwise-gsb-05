/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import type { ExecuteState, ICommand, TextAreaTextApi, TextRange } from '../core/src/commands';
import { quote } from '../core/src/commands/quote';
import { orderedListCommand, unorderedListCommand } from '../core/src/commands/list';
import { heading1 } from '../core/src/commands/title1';
import handleKeyDown from '../core/src/components/TextArea/handleKeyDown';

/**
 * Mirrors the real `TextAreaTextApi` semantics: `replaceSelection` replaces the
 * current selection and collapses the caret to the end of the inserted text,
 * `setSelectionRange` only moves the selection. Both return the fresh state.
 */
function createEditor(initialText: string, selection: TextRange) {
  let text = initialText;
  let range = { ...selection };
  const api = {
    replaceSelection(replacement: string) {
      text = text.slice(0, range.start) + replacement + text.slice(range.end);
      range = { start: range.start, end: range.start + replacement.length };
      return { text, selectedText: replacement, selection: { ...range } };
    },
    setSelectionRange(next: TextRange) {
      range = { ...next };
      return { text, selectedText: text.slice(range.start, range.end), selection: { ...range } };
    },
  };
  return {
    api: api as unknown as TextAreaTextApi,
    getText: () => text,
    getSelection: () => ({ ...range }),
  };
}

function execute(command: ICommand, text: string, selection: TextRange) {
  const editor = createEditor(text, selection);
  const state: ExecuteState = {
    text,
    selectedText: text.slice(selection.start, selection.end),
    selection: { ...selection },
    command,
  };
  command.execute!(state, editor.api);
  return editor;
}

function createTextarea(value: string, selection: TextRange) {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  document.body.appendChild(textarea);
  textarea.setSelectionRange(selection.start, selection.end);
  return textarea;
}

function keyboardEvent(textarea: HTMLTextAreaElement, init: { code: string; ctrlKey?: boolean; altKey?: boolean }) {
  return {
    keyCode: 0,
    ...init,
    target: textarea,
    stopPropagation: jest.fn(),
    preventDefault: jest.fn(),
  } as any;
}

describe('selectLine: line commands must not expand to the end of the text', () => {
  it('heading only targets the first line when the selection ends at a line break', () => {
    const editor = execute(heading1, 'line1\nline2\nline3', { start: 0, end: 5 });
    expect(editor.getText()).toBe('# line1\nline2\nline3');
    expect(editor.getSelection()).toEqual({ start: 2, end: 7 });
  });

  it('heading only targets a middle line when the selection ends at a line break', () => {
    const editor = execute(heading1, 'line1\nline2\nline3', { start: 6, end: 11 });
    expect(editor.getText()).toBe('line1\n# line2\nline3');
    expect(editor.getSelection()).toEqual({ start: 8, end: 13 });
  });

  it('heading still covers the last line when there is no trailing line break', () => {
    const editor = execute(heading1, 'line1\nline2\nline3', { start: 12, end: 17 });
    expect(editor.getText()).toBe('line1\nline2\n# line3');
    expect(editor.getSelection()).toEqual({ start: 14, end: 19 });
  });

  it('heading toggles off an existing heading', () => {
    const editor = execute(heading1, '# title', { start: 2, end: 2 });
    expect(editor.getText()).toBe('title');
    expect(editor.getSelection()).toEqual({ start: 0, end: 0 });
  });

  it('ctrl+d duplicates only the current line when the caret sits at a line break', () => {
    const textarea = createTextarea('ab\ncd', { start: 2, end: 2 });
    handleKeyDown(keyboardEvent(textarea, { code: 'KeyD', ctrlKey: true }));
    expect(textarea.value).toBe('ab\nab\ncd');
    expect(textarea.selectionStart).toBe(2);
    expect(textarea.selectionEnd).toBe(2);
  });

  it('alt+arrowdown moves only the current line down when the caret sits at a line break', () => {
    const textarea = createTextarea('ab\ncd', { start: 2, end: 2 });
    handleKeyDown(keyboardEvent(textarea, { code: 'ArrowDown', altKey: true }));
    expect(textarea.value).toBe('cd\nab');
    expect(textarea.selectionStart).toBe(3);
    expect(textarea.selectionEnd).toBe(5);
  });
});

describe('getBreaksNeededForEmptyLineBefore: exactly one empty line before a block', () => {
  it('quote adds the missing break when the document starts with a single line break', () => {
    const editor = execute(quote, '\nbbb', { start: 1, end: 4 });
    expect(editor.getText()).toBe('\n\n> bbb');
    expect(editor.getSelection()).toEqual({ start: 2, end: 7 });
  });

  it('quote does not insert breaks before a first line that only has leading spaces', () => {
    const editor = execute(quote, '  bbb', { start: 2, end: 5 });
    expect(editor.getText()).toBe('  > bbb');
    expect(editor.getSelection()).toEqual({ start: 2, end: 7 });
  });

  it('quote adds one break when only one line break exists before the selection', () => {
    const editor = execute(quote, 'aaa\nbbb', { start: 4, end: 7 });
    expect(editor.getText()).toBe('aaa\n\n> bbb');
    expect(editor.getSelection()).toEqual({ start: 5, end: 10 });
  });

  it('quote adds nothing when an empty line already exists before the selection', () => {
    const editor = execute(quote, 'aaa\n\nbbb', { start: 5, end: 8 });
    expect(editor.getText()).toBe('aaa\n\n> bbb');
    expect(editor.getSelection()).toEqual({ start: 5, end: 10 });
  });

  it('quote handles spaces between the line break and the selection', () => {
    const editor = execute(quote, 'aaa\n  bbb', { start: 6, end: 9 });
    expect(editor.getText()).toBe('aaa\n  \n> bbb');
    expect(editor.getSelection()).toEqual({ start: 7, end: 12 });
  });

  it('quote adds two breaks when the selection sits in the middle of a line', () => {
    const editor = execute(quote, 'aaa\nbb cc', { start: 7, end: 9 });
    expect(editor.getText()).toBe('aaa\nbb \n\n> cc');
    expect(editor.getSelection()).toEqual({ start: 9, end: 13 });
  });

  it('unordered list adds the missing break when the document starts with a single line break', () => {
    const editor = execute(unorderedListCommand, '\nbbb', { start: 1, end: 4 });
    expect(editor.getText()).toBe('\n\n- bbb');
    expect(editor.getSelection()).toEqual({ start: 2, end: 7 });
  });
});

describe('getBreaksNeededForEmptyLineAfter: no extra breaks near the end of the text', () => {
  it('quote does not insert breaks when the caret is at the last character', () => {
    const editor = execute(quote, 'hello', { start: 0, end: 4 });
    expect(editor.getText()).toBe('> hello');
    expect(editor.getSelection()).toEqual({ start: 0, end: 6 });
  });

  it('quote does not insert breaks when the selection reaches the end of the text', () => {
    const editor = execute(quote, 'hello', { start: 0, end: 5 });
    expect(editor.getText()).toBe('> hello');
    expect(editor.getSelection()).toEqual({ start: 0, end: 7 });
  });

  it('quote does not insert breaks when the text already ends with a line break', () => {
    const editor = execute(quote, 'hello\n', { start: 0, end: 5 });
    expect(editor.getText()).toBe('> hello\n');
    expect(editor.getSelection()).toEqual({ start: 0, end: 7 });
  });

  it('quote keeps exactly one empty line before the following text', () => {
    const editor = execute(quote, 'aaa\nbbb', { start: 0, end: 3 });
    expect(editor.getText()).toBe('> aaa\n\nbbb');
    expect(editor.getSelection()).toEqual({ start: 0, end: 5 });
  });

  it('unordered list does not insert breaks when the text already ends with a line break', () => {
    const editor = execute(unorderedListCommand, 'hello\n', { start: 0, end: 5 });
    expect(editor.getText()).toBe('- hello\n');
    expect(editor.getSelection()).toEqual({ start: 0, end: 7 });
  });
});

describe('existing line-command behaviors stay intact', () => {
  it('quote toggles off an existing quote', () => {
    const editor = execute(quote, '> title', { start: 0, end: 7 });
    expect(editor.getText()).toBe('title');
    expect(editor.getSelection()).toEqual({ start: 0, end: 5 });
  });

  it('quote prefixes every line of a multi-line selection', () => {
    const editor = execute(quote, 'aaa\nbbb', { start: 0, end: 7 });
    expect(editor.getText()).toBe('> aaa\n> bbb');
    expect(editor.getSelection()).toEqual({ start: 0, end: 11 });
  });

  it('quote works on empty text', () => {
    const editor = execute(quote, '', { start: 0, end: 0 });
    expect(editor.getText()).toBe('> ');
    expect(editor.getSelection()).toEqual({ start: 0, end: 2 });
  });

  it('unordered list toggles off an existing list', () => {
    const editor = execute(unorderedListCommand, '- a\n- b', { start: 0, end: 7 });
    expect(editor.getText()).toBe('a\nb');
    expect(editor.getSelection()).toEqual({ start: 0, end: 3 });
  });

  it('unordered list prefixes a single line', () => {
    const editor = execute(unorderedListCommand, 'title', { start: 0, end: 5 });
    expect(editor.getText()).toBe('- title');
    expect(editor.getSelection()).toEqual({ start: 0, end: 7 });
  });

  it('ordered list numbers every line of a multi-line selection', () => {
    const editor = execute(orderedListCommand, 'a\nb', { start: 0, end: 3 });
    expect(editor.getText()).toBe('1. a\n2. b');
    expect(editor.getSelection()).toEqual({ start: 0, end: 9 });
  });
});
