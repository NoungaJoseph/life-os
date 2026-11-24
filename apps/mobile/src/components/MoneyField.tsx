import React from 'react';
import type { TextInputProps } from 'react-native';
import { formatMoneyInput, stripMoneyFormatting } from '../lib/moneyInput';
import { Field } from './ui';

type MoneyFieldProps = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  label: string;
  value: string;
  onChangeText: (raw: string) => void;
  allowDecimal?: boolean;
  error?: string;
  hint?: string;
  right?: React.ReactNode;
  left?: React.ReactNode;
};

export function MoneyField({
  value,
  onChangeText,
  allowDecimal = false,
  keyboardType,
  ...rest
}: MoneyFieldProps) {
  return (
    <Field
      {...rest}
      value={formatMoneyInput(value, allowDecimal)}
      onChangeText={(next) => onChangeText(stripMoneyFormatting(next, allowDecimal))}
      keyboardType={keyboardType ?? (allowDecimal ? 'decimal-pad' : 'number-pad')}
    />
  );
}
