'use client'

import { Check, Minus } from 'lucide-react'
import {
  Checkbox as AriaCheckbox,
  CheckboxGroup as AriaCheckboxGroup,
  FieldError,
  Label,
  Text,
  composeRenderProps,
  type CheckboxGroupProps as AriaCheckboxGroupProps,
  type CheckboxProps as AriaCheckboxProps,
  type ValidationResult as AriaValidationResult
} from 'react-aria-components'

import { cn } from '@/lib/utils'

const CheckboxGroup = AriaCheckboxGroup

const Checkbox = ({ className, children, ...props }: AriaCheckboxProps) => (
  <AriaCheckbox
    className={composeRenderProps(className, className =>
      cn(
        'group/checkbox flex cursor-pointer items-center gap-x-2 text-sm text-white/70',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        className
      )
    )}
    {...props}
  >
    {composeRenderProps(children, (children, renderProps) => (
      <>
        <div
          aria-hidden="true"
          className={cn(
            'flex size-4 shrink-0 items-center justify-center rounded-sm border border-white/20 bg-black/20 text-transparent transition-[background-color,border-color,color,box-shadow,transform]',
            'group-data-[focus-visible]/checkbox:outline-none group-data-[focus-visible]/checkbox:ring-2 group-data-[focus-visible]/checkbox:ring-[#0084FF]/70 group-data-[focus-visible]/checkbox:ring-offset-2 group-data-[focus-visible]/checkbox:ring-offset-[#090b12]',
            'group-data-[indeterminate]/checkbox:border-[#0084FF] group-data-[selected]/checkbox:border-[#0084FF]',
            'group-data-[indeterminate]/checkbox:bg-[#0084FF] group-data-[selected]/checkbox:bg-[#0084FF]',
            'group-data-[indeterminate]/checkbox:text-white group-data-[selected]/checkbox:text-white',
            'group-data-[pressed]/checkbox:scale-95',
            'group-data-[invalid]/checkbox:border-red-400'
          )}
        >
          {renderProps.isIndeterminate ? (
            <Minus className="size-3.5 stroke-[2.5]" />
          ) : renderProps.isSelected ? (
            <Check className="size-3.5 stroke-[2.5]" />
          ) : null}
        </div>
        {children}
      </>
    ))}
  </AriaCheckbox>
)

interface JollyCheckboxGroupProps extends AriaCheckboxGroupProps {
  label?: string
  description?: string
  errorMessage?: string | ((validation: AriaValidationResult) => string)
}

function JollyCheckboxGroup({
  label,
  description,
  errorMessage,
  className,
  children,
  ...props
}: JollyCheckboxGroupProps) {
  return (
    <CheckboxGroup
      className={composeRenderProps(className, className =>
        cn('group flex flex-col gap-2', className)
      )}
      {...props}
    >
      {composeRenderProps(children, children => (
        <>
          {label && <Label className="text-sm font-medium text-white/75">{label}</Label>}
          {children}
          {description && (
            <Text className="text-sm text-white/45" slot="description">
              {description}
            </Text>
          )}
          <FieldError className="text-sm text-red-300">{errorMessage}</FieldError>
        </>
      ))}
    </CheckboxGroup>
  )
}

export { Checkbox, CheckboxGroup, JollyCheckboxGroup }
export type { JollyCheckboxGroupProps }
