'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';

import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@xata.io/components';
import { CheckCircleIcon, ChevronDownIcon } from 'lucide-react';
import { useParams } from 'next/navigation';
import { actionGetLanguageModels, actionGetLanguageModelsForProjectHybrid } from './actions';

type ModelInfo = { id: string; name: string };

interface ModelSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  projectId?: string;
}

export function ModelSelector({ value, onValueChange, className, projectId: propProjectId }: ModelSelectorProps) {
  const params = useParams<{ project?: string }>();
  const projectId = propProjectId || params.project;

  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Load models lazily when dropdown is opened
  // Uses hybrid approach: DB first (fast), provider registry as fallback
  useEffect(() => {
    if (open && !modelsLoaded) {
      if (projectId) {
        void actionGetLanguageModelsForProjectHybrid(projectId).then((loadedModels) => {
          setModels(loadedModels);
          setModelsLoaded(true);
        });
      } else {
        void actionGetLanguageModels().then((loadedModels) => {
          setModels(loadedModels);
          setModelsLoaded(true);
        });
      }
    }
  }, [open, projectId, modelsLoaded]);

  // Find selected model from loaded models list, or use value as display name
  const selectedModelName = useMemo(() => {
    const model = models.find((m) => m.id === value);
    return model?.name ?? value;
  }, [models, value]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        className={cn('data-[state=open]:bg-accent data-[state=open]:text-accent-foreground w-fit', className)}
      >
        <Button data-testid="model-selector" variant="outline" className="md:h-[34px] md:px-2">
          {selectedModelName || 'Select model'}
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[300px]">
        {models.map((model) => {
          const { id, name } = model;

          return (
            <DropdownMenuItem
              data-testid={`model-selector-item-${id}`}
              key={id}
              onSelect={() => {
                setOpen(false);

                startTransition(() => {
                  onValueChange(id);
                });
              }}
              data-active={id === value}
              asChild
            >
              <button type="button" className="group/item flex w-full flex-row items-center justify-between gap-4">
                <div className="flex flex-col items-start gap-1">
                  <div>{name}</div>
                </div>

                <div className="text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
                  <CheckCircleIcon />
                </div>
              </button>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
