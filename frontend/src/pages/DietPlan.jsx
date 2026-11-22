import React, { useState } from 'react';
import { Bean, Droplet, Flame, Utensils, Wheat } from 'lucide-react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { WorkspaceHeading } from '../components/layout/WorkspaceHeading';
import { Card, CardHeader, CardBody } from '../components/common/Card';
import { StatsCard } from '../components/common/StatsCard';
import { sampleDietWeek } from '../data/sampleDietPlan';

const energy = ({ protein, carbs, fat }) => 4 * protein + 4 * carbs + 9 * fat;

export function DietPlan() {
  const [selectedDay, setSelectedDay] = useState(0);
  const day = sampleDietWeek[selectedDay];
  const totals = day.meals.reduce(({ protein, carbs, fat }, meal) => ({
    protein: protein + meal.protein,
    carbs: carbs + meal.carbs,
    fat: fat + meal.fat,
  }), { protein: 0, carbs: 0, fat: 0 });

  return (
    <DashboardLayout>
      <div className="dashboard-stack">
        <WorkspaceHeading
          label="Nutrition"
          title="Diet plan"
          description="Explore a sample week of meals and nutrition totals."
        />

        <Card>
          <CardHeader title="Weekly plan" subtitle="Choose a day to view its meals." />
          <CardBody>
            <fieldset className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              <legend className="sr-only">Day of the week</legend>
              {sampleDietWeek.map(({ name }, index) => (
                <label key={name} className="cursor-pointer">
                  <input
                    className="peer sr-only"
                    type="radio"
                    name="diet-plan-day"
                    aria-label={name}
                    checked={index === selectedDay}
                    onChange={() => setSelectedDay(index)}
                  />
                  <span className="flex min-h-10 items-center justify-center rounded-lg border border-[color:var(--line)] px-2 text-sm font-semibold hover:bg-[color:var(--soft)] peer-checked:border-transparent peer-checked:bg-[color:var(--role-color)] peer-checked:text-slate-950 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--focus)]">
                    <abbr title={name} className="no-underline">{name.slice(0, 3)}</abbr>
                  </span>
                </label>
              ))}
            </fieldset>
          </CardBody>
        </Card>

        <section className="space-y-3" aria-labelledby="diet-totals">
          <h2 id="diet-totals" className="font-display text-3xl font-bold leading-none">{day.name} totals</h2>
          <div className="dashboard-metrics">
            <StatsCard title="Energy" value={energy(totals).toLocaleString()} subtitle="kcal planned" icon={Flame} />
            <StatsCard title="Protein" value={`${totals.protein} g`} icon={Bean} />
            <StatsCard title="Carbohydrates" value={`${totals.carbs} g`} icon={Wheat} />
            <StatsCard title="Fat" value={`${totals.fat} g`} icon={Droplet} />
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="diet-meals">
          <h2 id="diet-meals" className="font-display text-3xl font-bold leading-none">{day.name} meals</h2>
          <div className="workspace-split">
            {day.meals.map((meal) => (
              <Card key={meal.slot} className="h-full">
                <CardBody>
                  <div className="flex items-center gap-3">
                    <span className="tool-icon"><Utensils size={17} aria-hidden="true" /></span>
                    <div>
                      <p className="eyebrow">{meal.slot}</p>
                      <h3 className="font-display text-2xl font-bold leading-tight">{meal.title}</h3>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-[color:var(--muted)]">{meal.ingredients.join(' · ')}</p>
                  <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[color:var(--line)] pt-3 text-xs">
                    {[
                      ['Energy', `${energy(meal)} kcal`],
                      ['Protein', `${meal.protein} g`],
                      ['Carbs', `${meal.carbs} g`],
                      ['Fat', `${meal.fat} g`],
                    ].map(([label, amount]) => (
                      <div key={label}>
                        <dt className="text-[color:var(--muted)]">{label}</dt>
                        <dd className="mt-1 font-bold tabular-nums">{amount}</dd>
                      </div>
                    ))}
                  </dl>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
