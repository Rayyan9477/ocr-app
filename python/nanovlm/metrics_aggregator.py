#!/usr/bin/env python3
"""
Metrics Aggregator for nanoVLM OCR
Collects and analyzes metrics from OCR operations to identify patterns and improve system
"""

import os
import json
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime
import pandas as pd
import matplotlib.pyplot as plt
from collections import defaultdict

logger = logging.getLogger('nanovlm')

class MetricsAggregator:
    """Collects and analyzes OCR metrics"""
    
    def __init__(self, metrics_dir: str = None):
        """
        Initialize metrics aggregator
        
        Parameters:
        - metrics_dir: Directory to store metrics data
        """
        self.metrics_dir = metrics_dir or os.path.join(os.path.dirname(os.path.dirname(__file__)), 'metrics')
        os.makedirs(self.metrics_dir, exist_ok=True)
        
        self.metrics_file = os.path.join(self.metrics_dir, 'ocr_metrics.json')
        self.metrics = self._load_metrics()
    
    def _load_metrics(self) -> Dict[str, Any]:
        """Load metrics from file if it exists"""
        if os.path.exists(self.metrics_file):
            try:
                with open(self.metrics_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading metrics file: {e}")
                return self._create_empty_metrics()
        else:
            return self._create_empty_metrics()
    
    def _create_empty_metrics(self) -> Dict[str, Any]:
        """Create empty metrics structure"""
        return {
            'overall': {
                'total_documents': 0,
                'successful_documents': 0,
                'failed_documents': 0,
                'success_rate': 0.0,
                'average_time_ms': 0,
                'average_confidence': 0.0,
            },
            'by_document_type': {},
            'by_strategy': {},
            'by_error_type': {},
            'time_series': [],
            'last_update': datetime.now().isoformat(),
        }
    
    def add_result(self, result: Dict[str, Any], document_type: str) -> None:
        """
        Add OCR result to metrics
        
        Parameters:
        - result: OCR result dictionary
        - document_type: Type of document processed
        """
        # Update overall metrics
        self.metrics['overall']['total_documents'] += 1
        
        # Record timestamp for time series
        timestamp = datetime.now().isoformat()
        
        # Create time series entry
        # Normalize confidence for metrics (extract averageConfidence if dict)
        raw_conf = result.get('confidence', 0)
        if isinstance(raw_conf, dict):
            conf_value = raw_conf.get('averageConfidence', 0)
        else:
            conf_value = raw_conf
        time_entry = {
            'timestamp': timestamp,
            'document_type': document_type,
            'success': result.get('success', False),
            'processing_time': result.get('total_time', 0),
            'confidence': conf_value,
            'strategy': result.get('strategy', 'unknown'),
            'strategies_attempted': result.get('strategies_attempted', 1),
        }
        
        # Add to time series
        self.metrics['time_series'].append(time_entry)
        
        # Update document type metrics
        if document_type not in self.metrics['by_document_type']:
            self.metrics['by_document_type'][document_type] = {
                'total': 0,
                'successful': 0,
                'failed': 0,
                'success_rate': 0.0,
                'average_time_ms': 0,
                'average_confidence': 0.0,
            }
        
        doc_metrics = self.metrics['by_document_type'][document_type]
        doc_metrics['total'] += 1
        
        # Update strategy metrics
        strategy = result.get('strategy', 'unknown')
        if strategy not in self.metrics['by_strategy']:
            self.metrics['by_strategy'][strategy] = {
                'total': 0,
                'successful': 0,
                'failed': 0,
                'success_rate': 0.0,
                'average_time_ms': 0,
                'average_confidence': 0.0,
            }
        
        strategy_metrics = self.metrics['by_strategy'][strategy]
        strategy_metrics['total'] += 1
        
        # Update based on success/failure
        if result.get('success', False):
            self.metrics['overall']['successful_documents'] += 1
            doc_metrics['successful'] += 1
            strategy_metrics['successful'] += 1
            
            # Update confidence and time metrics
            confidence = result.get('confidence', 0)
            processing_time = result.get('total_time', 0)
            
            # Update overall averages
            overall = self.metrics['overall']
            overall['average_confidence'] = self._update_average(
                overall['average_confidence'],
                overall['successful_documents'] - 1,
                confidence
            )
            overall['average_time_ms'] = self._update_average(
                overall['average_time_ms'],
                overall['total_documents'] - 1,
                processing_time
            )
            
            # Update document type averages
            doc_metrics['average_confidence'] = self._update_average(
                doc_metrics['average_confidence'],
                doc_metrics['successful'] - 1,
                confidence
            )
            doc_metrics['average_time_ms'] = self._update_average(
                doc_metrics['average_time_ms'],
                doc_metrics['total'] - 1,
                processing_time
            )
            
            # Update strategy averages
            strategy_metrics['average_confidence'] = self._update_average(
                strategy_metrics['average_confidence'],
                strategy_metrics['successful'] - 1,
                confidence
            )
            strategy_metrics['average_time_ms'] = self._update_average(
                strategy_metrics['average_time_ms'],
                strategy_metrics['total'] - 1,
                processing_time
            )
        else:
            self.metrics['overall']['failed_documents'] += 1
            doc_metrics['failed'] += 1
            strategy_metrics['failed'] += 1
            
            # Track error types
            error_type = result.get('error_type', 'unknown')
            if error_type not in self.metrics['by_error_type']:
                self.metrics['by_error_type'][error_type] = 0
            self.metrics['by_error_type'][error_type] += 1
        
        # Update success rates
        overall = self.metrics['overall']
        overall['success_rate'] = overall['successful_documents'] / overall['total_documents'] * 100
        
        doc_metrics['success_rate'] = doc_metrics['successful'] / doc_metrics['total'] * 100
        strategy_metrics['success_rate'] = strategy_metrics['successful'] / strategy_metrics['total'] * 100
        
        # Update last update timestamp
        self.metrics['last_update'] = timestamp
        
        # Save metrics
        self._save_metrics()
    
    def _update_average(self, current_avg: float, count: int, new_value: float) -> float:
        """Calculate new average when adding a value to an existing average"""
        if count == 0:
            return new_value
        return (current_avg * count + new_value) / (count + 1)
    
    def _save_metrics(self) -> None:
        """Save metrics to file"""
        try:
            with open(self.metrics_file, 'w') as f:
                json.dump(self.metrics, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving metrics file: {e}")
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary metrics"""
        return {
            'overall_success_rate': self.metrics['overall']['success_rate'],
            'documents_processed': self.metrics['overall']['total_documents'],
            'average_processing_time': self.metrics['overall']['average_time_ms'],
            'average_confidence': self.metrics['overall']['average_confidence'],
            'by_document_type': {
                doc_type: {
                    'success_rate': metrics['success_rate'],
                    'count': metrics['total']
                } for doc_type, metrics in self.metrics['by_document_type'].items()
            },
            'top_strategies': sorted(
                [(k, v['success_rate']) for k, v in self.metrics['by_strategy'].items()],
                key=lambda x: x[1], reverse=True
            )[:3],
            'top_errors': sorted(
                [(k, v) for k, v in self.metrics['by_error_type'].items()],
                key=lambda x: x[1], reverse=True
            )[:3],
        }
    
    def generate_report(self, output_dir: Optional[str] = None) -> str:
        """
        Generate a detailed metrics report with visualizations
        
        Parameters:
        - output_dir: Directory to save the report (default: metrics_dir)
        
        Returns:
        - Path to the generated report
        """
        if output_dir is None:
            output_dir = self.metrics_dir
        
        os.makedirs(output_dir, exist_ok=True)
        report_path = os.path.join(output_dir, f'ocr_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.html')
        
        # Convert time series to DataFrame for analysis
        if not self.metrics['time_series']:
            logger.warning("No time series data available for report generation")
            return None
            
        df = pd.DataFrame(self.metrics['time_series'])
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Generate charts
        self._generate_charts(df, output_dir)
        
        # Create HTML report
        with open(report_path, 'w') as f:
            f.write(self._create_html_report(output_dir))
        
        logger.info(f"Report generated at {report_path}")
        return report_path
    
    def _generate_charts(self, df: pd.DataFrame, output_dir: str) -> None:
        """Generate charts for the report"""
        charts_dir = os.path.join(output_dir, 'charts')
        os.makedirs(charts_dir, exist_ok=True)
        
        # 1. Success rate over time
        plt.figure(figsize=(10, 6))
        df['success_numeric'] = df['success'].astype(int)
        df.set_index('timestamp')['success_numeric'].rolling('1D').mean().plot(
            title='OCR Success Rate (Daily Rolling Average)'
        )
        plt.ylabel('Success Rate')
        plt.tight_layout()
        plt.savefig(os.path.join(charts_dir, 'success_rate_time.png'))
        plt.close()
        
        # 2. Success by document type
        plt.figure(figsize=(10, 6))
        success_by_type = df.groupby('document_type')['success'].mean().sort_values(ascending=False)
        success_by_type.plot(kind='bar', title='Success Rate by Document Type')
        plt.ylabel('Success Rate')
        plt.tight_layout()
        plt.savefig(os.path.join(charts_dir, 'success_by_document_type.png'))
        plt.close()
        
        # 3. Success by strategy
        plt.figure(figsize=(10, 6))
        success_by_strategy = df.groupby('strategy')['success'].mean().sort_values(ascending=False)
        success_by_strategy.plot(kind='bar', title='Success Rate by Strategy')
        plt.ylabel('Success Rate')
        plt.tight_layout()
        plt.savefig(os.path.join(charts_dir, 'success_by_strategy.png'))
        plt.close()
        
        # 4. Processing time by document type
        plt.figure(figsize=(10, 6))
        time_by_type = df.groupby('document_type')['processing_time'].mean().sort_values(ascending=False)
        time_by_type.plot(kind='bar', title='Average Processing Time by Document Type')
        plt.ylabel('Time (ms)')
        plt.tight_layout()
        plt.savefig(os.path.join(charts_dir, 'time_by_document_type.png'))
        plt.close()
        
        # 5. Processing time by strategy
        plt.figure(figsize=(10, 6))
        time_by_strategy = df.groupby('strategy')['processing_time'].mean().sort_values(ascending=False)
        time_by_strategy.plot(kind='bar', title='Average Processing Time by Strategy')
        plt.ylabel('Time (ms)')
        plt.tight_layout()
        plt.savefig(os.path.join(charts_dir, 'time_by_strategy.png'))
        plt.close()
    
    def _create_html_report(self, output_dir: str) -> str:
        """Create HTML report content"""
        charts_dir = os.path.join(output_dir, 'charts')
        charts = [os.path.join('charts', f) for f in os.listdir(charts_dir) if f.endswith('.png')]
        
        # Get summary metrics
        summary = self.get_summary()
        
        # Create HTML content
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>OCR Metrics Report</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                h1, h2, h3 {{ color: #333366; }}
                .metric {{ margin-bottom: 10px; }}
                .metric-value {{ font-weight: bold; }}
                .chart {{ margin: 20px 0; }}
                .chart img {{ max-width: 100%; }}
                table {{ border-collapse: collapse; width: 100%; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #f2f2f2; }}
                tr:nth-child(even) {{ background-color: #f9f9f9; }}
            </style>
        </head>
        <body>
            <h1>OCR Metrics Report</h1>
            <p>Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            
            <h2>Summary</h2>
            <div class="metric">
                <span>Overall Success Rate:</span>
                <span class="metric-value">{summary['overall_success_rate']:.2f}%</span>
            </div>
            <div class="metric">
                <span>Documents Processed:</span>
                <span class="metric-value">{summary['documents_processed']}</span>
            </div>
            <div class="metric">
                <span>Average Processing Time:</span>
                <span class="metric-value">{summary['average_processing_time']:.2f} ms</span>
            </div>
            <div class="metric">
                <span>Average Confidence:</span>
                <span class="metric-value">{summary['average_confidence']:.2f}%</span>
            </div>
            
            <h2>Document Types</h2>
            <table>
                <tr>
                    <th>Document Type</th>
                    <th>Success Rate</th>
                    <th>Count</th>
                </tr>
        """
        
        # Add document type rows
        for doc_type, metrics in summary['by_document_type'].items():
            html += f"""
                <tr>
                    <td>{doc_type}</td>
                    <td>{metrics['success_rate']:.2f}%</td>
                    <td>{metrics['count']}</td>
                </tr>
            """
        
        html += """
            </table>
            
            <h2>Top Strategies</h2>
            <table>
                <tr>
                    <th>Strategy</th>
                    <th>Success Rate</th>
                </tr>
        """
        
        # Add strategy rows
        for strategy, success_rate in summary['top_strategies']:
            html += f"""
                <tr>
                    <td>{strategy}</td>
                    <td>{success_rate:.2f}%</td>
                </tr>
            """
        
        html += """
            </table>
            
            <h2>Top Errors</h2>
            <table>
                <tr>
                    <th>Error Type</th>
                    <th>Count</th>
                </tr>
        """
        
        # Add error rows
        for error_type, count in summary['top_errors']:
            html += f"""
                <tr>
                    <td>{error_type}</td>
                    <td>{count}</td>
                </tr>
            """
        
        html += """
            </table>
            
            <h2>Charts</h2>
        """
        
        # Add charts
        for chart in charts:
            html += f"""
            <div class="chart">
                <img src="{chart}" alt="OCR metrics chart">
            </div>
            """
        
        html += """
        </body>
        </html>
        """
        
        return html
