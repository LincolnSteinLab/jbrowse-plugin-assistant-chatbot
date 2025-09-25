import { zodResolver } from '@hookform/resolvers/zod'
import { CommandItem } from 'cmdk'
import { Check, ChevronsUpDown } from 'lucide-react'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from '@/components/ui/command'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import { ChatModelInfo, getAvailableModels } from '../agent/ChatModel'

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
    form.handleSubmit((s: Settings) => {
      model.set(s)
      form.reset(s)
    }),
  )
  // watch all dynamic fields
  const provider = form.watch('provider')
  const baseUrl = form.watch(`providerSettings.${provider}.baseUrl`)
  const apiKey = form.watch(`providerSettings.${provider}.apiKey`)
  const useProviderSystemPrompt = form.watch('useProviderSystemPrompt')
  // fetch list of available models from provider
  const [providerModels, setProviderModels] = useState<
    Record<string, ChatModelInfo>
  >({})
  useEffect(() => {
    let cancelled = false
    getAvailableModels({ provider, baseUrl, apiKey })
      .then(models => {
        if (!cancelled) setProviderModels(models)
      })
      .catch(error => {
        console.error('Error fetching available models', error)
        if (!cancelled) setProviderModels({})
      })
    return () => {
      cancelled = true
    }
  }, [provider, baseUrl, apiKey])
  // manage active model for displaying description
  const selectedModelId = form.watch(`providerSettings.${provider}.model`)
  const [activeModelInfo, setActiveModelInfo] = useState<ChatModelInfo | null>(
    null,
  )
  useEffect(() => {
    setActiveModelInfo(
      providerModels[selectedModelId] ??
        providerModels[Object.keys(providerModels)[0]] ??
        null,
    )
  }, [selectedModelId, providerModels])
  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="grid gap-2">
        <FormField
          control={form.control}
          name="provider"
          render={({ field }) => (
            <FormItem>
              <FormLabel>LLM Provider</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SettingsFormSchema.shape.provider.options.map(p => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <FormField
          key={provider + '-baseUrl'}
          control={form.control}
          name={`providerSettings.${provider}.baseUrl`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Alternate API URL</FormLabel>
              <FormDescription>
                Optionally override to a custom API endpoint.
              </FormDescription>
              <FormControl>
                <Input {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          key={provider + '-apiKey'}
          control={form.control}
          name={`providerSettings.${provider}.apiKey`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>LLM Provider API key</FormLabel>
              <FormDescription>
                See provider documentation for how to obtain an API key.
              </FormDescription>
              <FormControl>
                <Input type="password" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          key={provider + '-model'}
          control={form.control}
          name={`providerSettings.${provider}.model`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Model ID</FormLabel>
              <FormDescription>
                Model to use for agentic text generation.
              </FormDescription>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        'justify-between',
                        !field.value && 'text-muted-foreground',
                      )}
                    >
                      {field.value || 'Select a model...'}
                      <ChevronsUpDown className="text-muted-foreground opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-[560px] p-0">
                  <div className="grid grid-cols-2">
                    <Command
                      className="border-r"
                      onKeyDown={e => {
                        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                          requestAnimationFrame(() => {
                            const el = document.querySelector(
                              '[cmdk-item][data-selected="true"]',
                            )
                            const value = el?.getAttribute('data-value')
                            if (value) setActiveModelInfo(providerModels[value])
                          })
                        }
                      }}
                    >
                      <CommandInput
                        placeholder="Search models..."
                        className="h-9"
                      />
                      <CommandList>
                        <CommandEmpty>No models found.</CommandEmpty>
                        <CommandGroup heading={provider}>
                          {Object.entries(providerModels).map(([id, info]) => (
                            <CommandItem
                              value={id}
                              data-value={id}
                              key={provider + '-' + id}
                              onSelect={() => {
                                form.setValue(
                                  `providerSettings.${provider}.model`,
                                  id,
                                )
                                setActiveModelInfo(info)
                              }}
                              onMouseEnter={() => setActiveModelInfo(info)}
                              onFocus={() => setActiveModelInfo(info)}
                              className="flex items-center gap-1"
                            >
                              <Check
                                className={cn(
                                  'h-4 w-4',
                                  id === field.value
                                    ? 'opacity-100'
                                    : 'opacity-0',
                                )}
                              />
                              <span className="truncate">{id}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                    <div
                      className="p-3 overflow-scroll bg-muted/30 text-xs leading-relaxed"
                      aria-live="polite"
                    >
                      {activeModelInfo ? (
                        <div className="space-y-2">
                          <div className="font-medium text-sm">
                            {activeModelInfo.id}
                          </div>
                          <div className="text-muted-foreground whitespace-pre-wrap">
                            {activeModelInfo.description ?? ''}
                          </div>
                        </div>
                      ) : Object.keys(providerModels).length ? (
                        <div className="text-muted-foreground">
                          Hover or navigate to a model to see details.
                        </div>
                      ) : (
                        <div className="text-muted-foreground">
                          No models fetched. Verify provider/API key.
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="useProviderSystemPrompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>System Prompt Mode</FormLabel>
              <FormControl>
                <Select
                  onValueChange={val => field.onChange(val === 'true')}
                  value={String(field.value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={'false'}>Use default prompt</SelectItem>
                    <SelectItem value={'true'}>
                      Use provider-specific prompt
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          key={
            useProviderSystemPrompt
              ? provider + '-systemPrompt'
              : 'defaultSystemPrompt'
          }
          control={form.control}
          name={
            useProviderSystemPrompt
              ? `providerSettings.${provider}.systemPrompt`
              : 'defaultSystemPrompt'
          }
          render={({ field }) => (
            <FormItem>
              <FormLabel>System Prompt</FormLabel>
              <FormDescription>
                Outline instructions for the LLM agent.
              </FormDescription>
              <FormControl>
                <Textarea {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={!form.formState.isDirty}>
          Save
        </Button>
      </form>
    </Form>
  )
})
