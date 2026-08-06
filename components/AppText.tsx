import React from 'react';
import { Text as RNText, type TextProps } from 'react-native';
import { FONTS } from '@/lib/fonts';

export default function AppText(props: TextProps) {
  const { style, ...rest } = props;
  return <RNText {...rest} style={[{ fontFamily: FONTS.sans }, style]} />;
}