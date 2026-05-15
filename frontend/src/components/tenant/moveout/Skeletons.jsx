import { cn } from '@/lib/utils';

function Bone({ className }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-200/70', className)} />;
}

export function StepsSkeleton() {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5">
      <Bone className="h-6 w-28 mb-4" />
      <Bone className="h-4 w-full mb-6" />
      <div className="flex justify-between">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col items-center flex-1">
            <Bone className="w-8 h-8 rounded-full mb-1.5" />
            <Bone className="h-2.5 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettlementSkeleton() {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5">
      <Bone className="h-3 w-24 mb-2" />
      <Bone className="h-9 w-36 mb-1" />
      <Bone className="h-3 w-20 mt-2" />
    </div>
  );
}

export function TimelineSkeleton() {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5">
      <Bone className="h-4 w-32 mb-5" />
      <div className="space-y-5 pl-6">
        {[...Array(3)].map((_, i) => (
          <div key={i}>
            <Bone className="h-4 w-48 mb-1" />
            <Bone className="h-3 w-32 mb-1" />
            <Bone className="h-2.5 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListItemSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-white">
      <div className="flex justify-between mb-2">
        <Bone className="h-4 w-28" />
        <Bone className="h-5 w-16 rounded-md" />
      </div>
      <div className="flex gap-3">
        <Bone className="h-3 w-16" />
        <Bone className="h-3 w-20" />
        <Bone className="h-3 w-14" />
      </div>
    </div>
  );
}

export function FullPageSkeleton() {
  return (
    <div className="max-w-lg mx-auto space-y-4 pt-2">
      <StepsSkeleton />
      <SettlementSkeleton />
      <TimelineSkeleton />
    </div>
  );
}
