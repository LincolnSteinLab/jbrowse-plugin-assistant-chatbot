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
import { Label } from '@/components/ui/label'
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
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { cn, withExceptionCapturing } from '@/lib/utils'

import { ChatModelInfo, getAvailableModels } from '../agent/ChatModel'

import { ApiKeyVault } from './ApiKeyVault'
import { IChatWidgetModel } from './model/ChatbotWidgetModel'
import { Settings, SettingsFormSchema } from './model/SettingsFormModel'

export const SettingsForm = observer(function ({
  model,
}: {
  model: IChatWidgetModel
}) {
  const { settingsForm, apiKeyVault } = model
  const form = useForm<Settings>({
    resolver: zodResolver(SettingsFormSchema),
    defaultValues: settingsForm.settings,
  })
  const onSubmit = withExceptionCapturing(
    form.handleSubmit((s: Settings) => {
      settingsForm.set(s)
      form.reset(s)
    }),
  )
  // watch all dynamic fields
  const provider = form.watch('provider')
  const baseUrl = form.watch(`providerSettings.${provider}.baseUrl`)
  const useProviderSystemPrompt = form.watch('useProviderSystemPrompt')
  // fetch list of available models from provider
  const [providerModels, setProviderModels] = useState<
    Record<string, ChatModelInfo>
  >({})
  const [modelSearchValue, setModelSearchValue] = useState<string>('')
  useEffect(() => {
    let cancelled = false
    getAvailableModels({
      provider,
      baseUrl,
      getApiKey: ({}) => {
        if (apiKeyVault.exists(provider)) return apiKeyVault.get(provider)
        return new Promise(resolve => resolve(undefined))
      },
    })
      .then(models => {
        if (!cancelled) setProviderModels(models)
      })
      .catch(() => {
        if (!cancelled) setProviderModels({})
      })
    return () => {
      cancelled = true
    }
  }, [provider, baseUrl, apiKeyVault])
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
              <FormLabel>Language Model API</FormLabel>
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
              <FormLabel>Alternate API Endpoint</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <ApiKeyVault model={model} />
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
                        value={modelSearchValue}
                        onValueChange={val => setModelSearchValue(val.trim())}
                      />
                      <CommandList>
                        <CommandEmpty>No models found.</CommandEmpty>
                        {!modelSearchValue ||
                        modelSearchValue in providerModels ? null : (
                          <CommandGroup>
                            <CommandItem
                              value={modelSearchValue}
                              data-value={modelSearchValue}
                              key={provider + '-input-' + modelSearchValue}
                              onSelect={() => {
                                form.setValue(
                                  `providerSettings.${provider}.model`,
                                  modelSearchValue,
                                )
                                setActiveModelInfo(
                                  providerModels[modelSearchValue] ?? null,
                                )
                              }}
                              onMouseEnter={() =>
                                setActiveModelInfo(
                                  providerModels[modelSearchValue] ?? null,
                                )
                              }
                              onFocus={() =>
                                setActiveModelInfo(
                                  providerModels[modelSearchValue] ?? null,
                                )
                              }
                              className="flex items-center gap-1"
                            >
                              <Check
                                className={cn(
                                  'h-4 w-4',
                                  modelSearchValue === field.value
                                    ? 'opacity-100'
                                    : 'opacity-0',
                                )}
                              />
                              <span className="truncate">
                                {modelSearchValue}
                              </span>
                            </CommandItem>
                          </CommandGroup>
                        )}
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
          key="useProviderSystemPrompt"
          control={form.control}
          name="useProviderSystemPrompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="useProviderSystemPrompt-select">
                Prompt Mode
              </FormLabel>
              <FormControl>
                <Select
                  {...field}
                  onValueChange={val => field.onChange(val === 'true')}
                  value={String(field.value)}
                >
                  <SelectTrigger id="useProviderSystemPrompt-select">
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
              <FormLabel>Prompt</FormLabel>
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
        <FormField
          key={provider + '-temperature'}
          control={form.control}
          name={`providerSettings.${provider}.temperature`}
          render={({ field }) => (
            <FormItem>
              <Label id={`providerSettings.${provider}.temperature-label`}>
                Temperature
              </Label>
              <FormControl>
                <div className="flex items-center">
                  <Slider
                    {...field}
                    aria-labelledby={`providerSettings.${provider}.temperature-label`}
                    min={0}
                    max={100}
                    step={1}
                    value={[field.value ?? 0]}
                    onValueChange={val => field.onChange(val[0])}
                    className="flex-1 py-2"
                  />
                  <div className="w-10 text-right text-sm tabular-nums">
                    {field.value ?? 0}%
                  </div>
                </div>
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
