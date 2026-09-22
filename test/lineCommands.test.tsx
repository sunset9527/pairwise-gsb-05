/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MDEditor, { commands } from '../core/src';
import type { ICommand } from '../core/src/commands';

const QUOTE_LABEL = 'Insert a quote (ctrl + q)';
const UL_LABEL = 'Add unordered list (ctrl + shift + u)';

function renderEditor(initialValue: string, cmds?: ICommand[]) {
  const MyComponent = () => {
    const [value, setValue] = React.useState(initialValue);
    return (
      <MDEditor
        value={value}
        textareaProps={{ title: 'test' }}
        onChange={(value) => setValue(value || '')}
        {...(cmds ? { commands: cmds } : {})}
      />
    );
  };
  render(<MyComponent />);
  return screen.getByTitle<HTMLTextAreaElement>('test');
}

function clickCommand(label: string) {
  fireEvent(
    screen.getByLabelText(label),
    new MouseEvent('click', { bubbles: true, cancelable: true }),
  );
}

describe('selectLine boundary (line-level operations)', () => {
  it('ctrl+d duplicates only the target line when the selection ends exactly at a newline', () => {
    const handleChange = jest.fn((value) => value);
    render(<MDEditor value={`aaa\nbbb`} textareaProps={{ title: 'test' }} onChange={handleChange} />);
    const input = screen.getByTitle<HTMLTextAreaElement>('test');
    input.setSelectionRange(0, 3);
    fireEvent.keyDown(input, { key: 'd', code: 'KeyD', ctrlKey: true });
    expect(handleChange).toHaveReturnedWith('aaa\naaa\nbbb');
  });

  it('ctrl+d duplicates the last line when the cursor is at the end of the text', () => {
    const handleChange = jest.fn((value) => value);
    render(<MDEditor value={`ab\ncd`} textareaProps={{ title: 'test' }} onChange={handleChange} />);
    const input = screen.getByTitle<HTMLTextAreaElement>('test');
    input.setSelectionRange(4, 4);
    fireEvent.keyDown(input, { key: 'd', code: 'KeyD', ctrlKey: true });
    expect(handleChange).toHaveReturnedWith('ab\ncd\ncd');
  });

  it('heading applies only to the target line when the selection ends at a newline', () => {
    const input = renderEditor('aaa\nbbb', [commands.heading1]);
    input.setSelectionRange(0, 3);
    clickCommand('Insert Heading 1 (ctrl + 1)');
    expect(input).toHaveValue('# aaa\nbbb');
  });
});

describe('empty line before inserted block (quote / list)', () => {
  it('quote keeps exactly one empty line before when the text starts with a single newline', () => {
    const input = renderEditor('\nhello', [commands.quote]);
    input.setSelectionRange(3, 3);
    clickCommand(QUOTE_LABEL);
    expect(input).toHaveValue('\n\n> hello');
  });

  it('quote keeps exactly one empty line before when the text starts with two newlines', () => {
    const input = renderEditor('\n\nhello', [commands.quote]);
    input.setSelectionRange(4, 4);
    clickCommand(QUOTE_LABEL);
    expect(input).toHaveValue('\n\n> hello');
  });

  it('quote adds no extra breaks on the first line with leading spaces', () => {
    const input = renderEditor('  hello', [commands.quote]);
    input.setSelectionRange(4, 4);
    clickCommand(QUOTE_LABEL);
    expect(input).toHaveValue('  > hello');
  });

  it('quote adds one empty line before when the previous line has text', () => {
    const input = renderEditor('abc\ndef', [commands.quote]);
    input.setSelectionRange(5, 5);
    clickCommand(QUOTE_LABEL);
    expect(input).toHaveValue('abc\n\n> def');
  });

  it('quote adds no extra break when an empty line already exists before', () => {
    const input = renderEditor('abc\n\ndef', [commands.quote]);
    input.setSelectionRange(6, 6);
    clickCommand(QUOTE_LABEL);
    expect(input).toHaveValue('abc\n\n> def');
  });

  it('unordered list keeps exactly one empty line before when the text starts with a newline', () => {
    const input = renderEditor('\nhello', [commands.unorderedListCommand]);
    input.setSelectionRange(3, 3);
    clickCommand(UL_LABEL);
    expect(input).toHaveValue('\n\n- hello');
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(9);
  });
});

describe('empty line after inserted block near the end of text (quote / list)', () => {
  it('quote does not insert an extra break when the text already ends with a newline', () => {
    const input = renderEditor('abc\n', [commands.quote]);
    input.setSelectionRange(3, 3);
    clickCommand(QUOTE_LABEL);
    expect(input).toHaveValue('> abc\n');
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(5);
  });

  it('quote adds no breaks when the cursor is on the last character', () => {
    const input = renderEditor('abc', [commands.quote]);
    input.setSelectionRange(2, 2);
    clickCommand(QUOTE_LABEL);
    expect(input).toHaveValue('> abc');
  });

  it('quote adds no breaks when the cursor is at the end of the text', () => {
    const input = renderEditor('abc', [commands.quote]);
    input.setSelectionRange(3, 3);
    clickCommand(QUOTE_LABEL);
    expect(input).toHaveValue('> abc');
  });

  it('unordered list does not insert an extra break when the text already ends with a newline', () => {
    const input = renderEditor('abc\n', [commands.unorderedListCommand]);
    input.setSelectionRange(3, 3);
    clickCommand(UL_LABEL);
    expect(input).toHaveValue('- abc\n');
  });

  it('quote on empty text inserts only the prefix', () => {
    const input = renderEditor('', [commands.quote]);
    input.setSelectionRange(0, 0);
    clickCommand(QUOTE_LABEL);
    expect(input).toHaveValue('> ');
  });
});
