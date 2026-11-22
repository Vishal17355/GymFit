import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Utensils } from 'lucide-react';
import { Card, CardBody } from '../common/Card';

export function DietPlanCard({ className = '', to = '/member/diet-plan', onClick }) {
  const content = (
    <>
      <span className="tool-icon"><Utensils size={18} aria-hidden="true" /></span>
      <span><strong>Diet plan</strong><small>View weekly meals and nutrition totals</small></span>
      <ArrowUpRight size={17} aria-hidden="true" />
    </>
  );

  return (
    <Card className={className} hover>
      <CardBody className="detail-list">
        {onClick ? (
          <button type="button" className="detail-row tool-row w-full text-left" onClick={onClick}>{content}</button>
        ) : (
          <Link className="detail-row tool-row" to={to}>{content}</Link>
        )}
      </CardBody>
    </Card>
  );
}
