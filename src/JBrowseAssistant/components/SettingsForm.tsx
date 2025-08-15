import { zodResolver } from '@hookform/resolvers/zod'
import { observer } from 'mobx-react'
import React from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import {
  ISettingsFormModel,
  Settings,
  SettingsFormSchema,
} from './model/SettingsFormModel'

function withExceptionCapturing<S, T extends unknown[]>(
  fn: (...rest: T) => Promise<S>,
) {
  return (...args: T) => {
    fn(...args).catch(error => {
      console.error('Unexpected error', error)
    })
  }
}

export const SettingsForm = observer(function ({
  model,
}: {
  model: ISettingsFormModel
}) {
  const form = useForm<Settings>({
    resolver: zodResolver(SettingsFormSchema),
    defaultValues: model.settings,
  })
  const onSubmit = withExceptionCapturing(
    form.handleSubmit((s: Settings) => model.set(s)),
  )
  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="grid gap-2">
        <FormField
          control={form.control}
          name="provider"
          render={({ field }) => (
            <FormItem>
              <FormLabel>LLM Provider</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SettingsFormSchema.shape.provider.options.map(provider => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="baseUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Alternate API URL</FormLabel>
              <FormDescription>
                Optionally override the provider's API URL to a custom endpoint.
              </FormDescription>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="apiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>LLM Provider API key</FormLabel>
              <FormDescription>
                See the LLM provider's documentation for how to obtain an API key.
              </FormDescription>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="model"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Model ID</FormLabel>
              <FormDescription>
                Model to use for text generation.
              </FormDescription>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="systemPrompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>System Prompt</FormLabel>
              <FormDescription>
                Outline instructions for the LLM agent.
              </FormDescription>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save</Button>
      </form>
    </Form>
  )
})
